"""
One-time script: parse MIDI files from a directory and upload to Firestore.

Filename format expected: Artist - Title.mid  OR  Title.mid  OR  Title_With_Underscores.mid
Picks the single most note-dense track from each MIDI file.

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
    export FIREBASE_STORAGE_BUCKET=bc-hacks-6434f.firebasestorage.app
    python upload_lakh.py /path/to/mysongs/
"""

import pathlib
import re
import sys

import mido


_COLLECTION = "lakh_tracks"
_DEFAULT_TEMPO_US = 500_000  # 120 BPM


def _ticks_to_seconds(ticks: int, tempo_map: list[tuple[int, int]], ticks_per_beat: int) -> float:
    """Convert absolute ticks to seconds using a tempo map of (abs_tick, tempo_us) pairs."""
    seconds = 0.0
    prev_tick, prev_tempo = 0, _DEFAULT_TEMPO_US
    for map_tick, map_tempo in tempo_map:
        if map_tick >= ticks:
            break
        seconds += (min(map_tick, ticks) - prev_tick) * prev_tempo / ticks_per_beat / 1_000_000
        prev_tick, prev_tempo = map_tick, map_tempo
    seconds += (ticks - prev_tick) * prev_tempo / ticks_per_beat / 1_000_000
    return seconds


def _build_tempo_map(mid: mido.MidiFile) -> list[tuple[int, int]]:
    """Walk all tracks and collect (absolute_tick, tempo_us) change points."""
    changes = []
    for track in mid.tracks:
        abs_tick = 0
        for msg in track:
            abs_tick += msg.time
            if msg.type == "set_tempo":
                changes.append((abs_tick, msg.tempo))
    changes.sort(key=lambda x: x[0])
    return changes


def _parse_midi(path: pathlib.Path) -> list[dict]:
    """
    Parse a MIDI file and return note events from the most note-dense track.
    Returns list of {time, duration, pitch, confidence} dicts.
    """
    mid = mido.MidiFile(str(path))
    ticks_per_beat = mid.ticks_per_beat or 480
    tempo_map = _build_tempo_map(mid)

    best_notes = []

    for track in mid.tracks:
        active: dict[int, tuple[int, int]] = {}  # pitch -> (abs_tick, velocity)
        abs_tick = 0
        notes = []

        for msg in track:
            abs_tick += msg.time
            if msg.type == "note_on" and msg.velocity > 0:
                active[msg.note] = (abs_tick, msg.velocity)
            elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
                if msg.note in active:
                    start_tick, _ = active.pop(msg.note)
                    start_sec = _ticks_to_seconds(start_tick, tempo_map, ticks_per_beat)
                    end_sec = _ticks_to_seconds(abs_tick, tempo_map, ticks_per_beat)
                    duration = end_sec - start_sec
                    if duration > 0:
                        notes.append({
                            "time": round(start_sec, 4),
                            "duration": round(duration, 4),
                            "pitch": float(msg.note),
                            "confidence": 1.0,
                        })

        if len(notes) > len(best_notes):
            best_notes = notes

    best_notes.sort(key=lambda n: n["time"])
    return best_notes


def _dominant_tempo_bpm(mid: mido.MidiFile) -> int:
    for track in mid.tracks:
        for msg in track:
            if msg.type == "set_tempo":
                return int(round(60_000_000 / msg.tempo))
    return 120


def _parse_filename(path: pathlib.Path) -> tuple[str, str]:
    """Return (artist, title) from filename. Handles 'Artist - Title' or just 'Title'."""
    name = path.stem.replace("_", " ")
    if " - " in name:
        artist, title = name.split(" - ", 1)
        return artist.strip(), title.strip()
    return "Unknown", name.strip()


def _make_track_id(path: pathlib.Path) -> str:
    stem = re.sub(r"[^a-zA-Z0-9]+", "_", path.stem).strip("_").lower()
    return f"lakh_{stem}"


def _upload_midi_to_storage(bucket, path: pathlib.Path, track_id: str) -> str:
    """Upload a MIDI file to Firebase Storage and return its public download URL."""
    blob = bucket.blob(f"midi/{track_id}.mid")
    blob.upload_from_filename(str(path), content_type="audio/midi")
    blob.make_public()
    return blob.public_url


def upload(midi_dir: str) -> None:
    import os
    import firebase_admin
    from firebase_admin import credentials, firestore, storage

    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    storage_bucket = os.environ.get("FIREBASE_STORAGE_BUCKET", "bc-hacks-6434f.firebasestorage.app")

    cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {"storageBucket": storage_bucket})
    db = firestore.client()
    bucket = storage.bucket()
    collection = db.collection(_COLLECTION)

    midi_files = sorted(pathlib.Path(midi_dir).glob("*.mid"))
    if not midi_files:
        print(f"No .mid files found in {midi_dir}")
        return

    for i, path in enumerate(midi_files):
        try:
            mid = mido.MidiFile(str(path))
            notes = _parse_midi(path)
            if not notes:
                print(f"[{i+1}/{len(midi_files)}] SKIP {path.name} — no notes found")
                continue

            artist, title = _parse_filename(path)
            tempo_bpm = _dominant_tempo_bpm(mid)
            duration = max(n["time"] + n["duration"] for n in notes)
            track_id = _make_track_id(path)

            midi_url = _upload_midi_to_storage(bucket, path, track_id)

            collection.document(track_id).set({
                "title": title,
                "artist": artist,
                "instrument": "piano",
                "tempo_bpm": tempo_bpm,
                "duration_seconds": round(duration, 2),
                "source_file": path.name,
                "midi_url": midi_url,
                "notes": notes,
            })
            print(f"[{i+1}/{len(midi_files)}] Uploaded '{title}' by {artist} — {len(notes)} notes, {tempo_bpm} BPM")

        except Exception as exc:
            print(f"[{i+1}/{len(midi_files)}] ERROR {path.name}: {exc}")

    print(f"\nDone — processed {len(midi_files)} files.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upload_lakh.py /path/to/midi/dir/")
        sys.exit(1)
    upload(sys.argv[1])
"""
LAKH MIDI reference store — backed by Firestore.

At startup, load_all() fetches all documents from the
`lakh_tracks` collection and caches them in memory.

Auth: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
or run inside a GCP environment with ADC configured.
"""

import os
from dataclasses import dataclass, field

from transcribe import NoteEvent

_COLLECTION = "lakh_tracks"

_store: dict[str, list[NoteEvent]] = {}
_meta: dict[str, dict] = {}


@dataclass
class TrackInfo:
    track_id: str
    title: str
    artist: str
    instrument: str
    tempo_bpm: int
    note_count: int
    duration_seconds: float
    notes: list[NoteEvent] = field(default_factory=list)


def _get_db():
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    return firestore.client()


def load_all() -> None:
    """Fetch all LAKH tracks from Firestore and cache in memory."""
    try:
        db = _get_db()
    except Exception as exc:
        print(f"[reference_store] WARNING: could not connect to Firestore: {exc}")
        return

    docs = db.collection(_COLLECTION).stream()
    count = 0
    for doc in docs:
        data = doc.to_dict()
        notes = [
            NoteEvent(
                time=float(n["time"]),
                duration=float(n["duration"]),
                pitch=float(n["pitch"]),
                confidence=1.0,
            )
            for n in data.get("notes", [])
        ]
        _store[doc.id] = notes
        _meta[doc.id] = {
            "title": data.get("title", "Unknown"),
            "artist": data.get("artist", "Unknown"),
            "instrument": data.get("instrument", "unknown"),
            "tempo_bpm": int(data.get("tempo_bpm", 0)),
            "note_count": len(notes),
            "duration_seconds": float(data.get("duration_seconds", 0.0)),
        }
        count += 1

    print(f"[reference_store] Loaded {count} LAKH tracks from Firestore")


def get_track_ids() -> list[str]:
    return sorted(_store.keys())


def get_notes(track_id: str) -> list[NoteEvent]:
    if track_id not in _store:
        raise KeyError(f"Track '{track_id}' not found. {len(_store)} tracks loaded.")
    return _store[track_id]


def get_track_info(track_id: str) -> TrackInfo:
    if track_id not in _store:
        raise KeyError(f"Track '{track_id}' not found. {len(_store)} tracks loaded.")
    m = _meta[track_id]
    return TrackInfo(
        track_id=track_id,
        title=m["title"],
        artist=m["artist"],
        instrument=m["instrument"],
        tempo_bpm=m["tempo_bpm"],
        note_count=m["note_count"],
        duration_seconds=m["duration_seconds"],
        notes=_store[track_id],
    )

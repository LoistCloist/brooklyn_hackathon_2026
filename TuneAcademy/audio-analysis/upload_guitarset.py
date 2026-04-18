"""
One-time script: parse GuitarSet JAMS files and upload to Firestore.

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
    python upload_guitarset.py /path/to/guitarset/annotations/
"""

import json
import os
import pathlib
import sys


def _parse_jams(path: pathlib.Path) -> list[dict]:
    with open(path) as f:
        jams = json.load(f)

    notes = []
    for annotation in jams.get("annotations", []):
        if annotation.get("namespace") != "note_midi":
            continue
        for obs in annotation.get("data", []):
            pitch = obs.get("value")
            time = obs.get("time")
            duration = obs.get("duration")
            if pitch is None or time is None or duration is None or duration <= 0:
                continue
            notes.append({
                "time": float(time),
                "duration": float(duration),
                "pitch": float(pitch),
                "confidence": float(obs.get("confidence") or 1.0),
            })

    notes.sort(key=lambda n: n["time"])
    return notes


def _parse_metadata(track_id: str) -> dict:
    try:
        _, rest = track_id.split("_", 1)
        middle, style = rest.rsplit("_", 1)
        parts = middle.split("-")
        return {
            "progression": parts[0],
            "tempo": int(parts[1]) if len(parts) > 1 else 0,
            "key": parts[2] if len(parts) > 2 else "?",
            "style": style,
        }
    except (ValueError, IndexError):
        return {"progression": "?", "tempo": 0, "key": "?", "style": "?"}


def upload(annotations_dir: str) -> None:
    import firebase_admin
    from firebase_admin import credentials, firestore

    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    collection = db.collection("guitarset_tracks")

    jams_files = sorted(pathlib.Path(annotations_dir).glob("*.jams"))
    if not jams_files:
        print(f"No .jams files found in {annotations_dir}")
        return

    for i, path in enumerate(jams_files):
        track_id = path.stem
        notes = _parse_jams(path)
        meta = _parse_metadata(track_id)

        collection.document(track_id).set({
            **meta,
            "notes": notes,
        })
        print(f"[{i+1}/{len(jams_files)}] Uploaded {track_id} ({len(notes)} notes)")

    print(f"\nDone — {len(jams_files)} tracks uploaded to Firestore.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upload_guitarset.py /path/to/annotations/")
        sys.exit(1)
    upload(sys.argv[1])

"""
GuitarSet reference store — backed by Firestore.

At startup, load_all() fetches all documents from the
`guitarset_tracks` collection and caches them in memory.

Auth: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
or run inside a GCP environment with ADC configured.
"""

import os
from dataclasses import dataclass, field

from transcribe import NoteEvent

_COLLECTION = "guitarset_tracks"

_store: dict[str, list[NoteEvent]] = {}


@dataclass
class TrackInfo:
    track_id: str
    progression: str
    tempo: int
    key: str
    style: str
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
    """Fetch all GuitarSet tracks from Firestore and cache in memory."""
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
                confidence=float(n["confidence"]),
            )
            for n in data.get("notes", [])
        ]
        _store[doc.id] = notes
        count += 1

    print(f"[reference_store] Loaded {count} tracks from Firestore")


def get_track_ids() -> list[str]:
    return sorted(_store.keys())


def get_notes(track_id: str) -> list[NoteEvent]:
    if track_id not in _store:
        raise KeyError(f"Track '{track_id}' not found. {len(_store)} tracks loaded.")
    return _store[track_id]


def get_track_info(track_id: str) -> TrackInfo:
    notes = get_notes(track_id)
    try:
        _, rest = track_id.split("_", 1)
        middle, style = rest.rsplit("_", 1)
        parts = middle.split("-")
        progression = parts[0]
        tempo = int(parts[1]) if len(parts) > 1 else 0
        key = parts[2] if len(parts) > 2 else "?"
    except (ValueError, IndexError):
        progression, tempo, key, style = "?", 0, "?", "?"

    return TrackInfo(
        track_id=track_id,
        progression=progression,
        tempo=tempo,
        key=key,
        style=style,
        notes=notes,
    )

"""GET /tracks — list available GuitarSet reference tracks."""

from fastapi import APIRouter, HTTPException

import reference_store

router = APIRouter(tags=["tracks"])


@router.get("/tracks")
def list_tracks():
    return {
        "tracks": [
            reference_store.get_track_info(tid).__dict__
            for tid in reference_store.get_track_ids()
        ]
    }


@router.get("/tracks/{track_id}")
def get_track(track_id: str):
    try:
        info = reference_store.get_track_info(track_id)
        return {**info.__dict__, "notes": None}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

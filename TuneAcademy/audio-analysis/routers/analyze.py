"""POST /analyze — PRD mock response; optional Bearer token logged only."""

from fastapi import APIRouter, File, Form, Header, UploadFile

router = APIRouter(tags=["analyze"])

MOCK_REPORT = {
    "instrument": "guitar",
    "overall_score": 72,
    "dimension_scores": {
        "pitch_centre": 85,
        "pitch_stability": 60,
        "rhythm": 90,
        "tone_quality": 55,
        "note_attack": 78,
    },
    "weaknesses": [
        "Pitch is unstable — check fretting pressure and finger placement.",
        "Tone quality differs from reference — possible string buzz.",
    ],
}


@router.post("/analyze")
async def analyze(
    instrument: str = Form("guitar"),
    audio: UploadFile | None = File(default=None),
    authorization: str | None = Header(None),
):
    _ = audio  # stub: accept multipart shape from PRD; bytes not read in MVP
    _ = authorization  # MVP: Firebase Bearer verification deferred
    body = {**MOCK_REPORT, "instrument": instrument or MOCK_REPORT["instrument"]}
    return body

"""GET /reports/{user_id} — PRD: sorted mock reports (stub)."""

from fastapi import APIRouter

router = APIRouter(tags=["reports"])

MOCK_REPORTS = [
    {
        "id": "r1",
        "userId": "demo-user",
        "instrument": "guitar",
        "overallScore": 72,
        "dimensionScores": {
            "pitchCentre": 85,
            "pitchStability": 60,
            "rhythm": 90,
            "toneQuality": 55,
            "noteAttack": 78,
        },
        "weaknesses": [
            "Pitch is unstable — check fretting pressure and finger placement.",
        ],
        "createdAt": "2026-04-10T12:00:00Z",
    },
    {
        "id": "r2",
        "userId": "demo-user",
        "instrument": "guitar",
        "overallScore": 65,
        "dimensionScores": {
            "pitchCentre": 70,
            "pitchStability": 55,
            "rhythm": 82,
            "toneQuality": 50,
            "noteAttack": 72,
        },
        "weaknesses": ["Rhythm slightly ahead of the beat on eighth notes."],
        "createdAt": "2026-04-03T12:00:00Z",
    },
]


@router.get("/reports/{user_id}")
async def list_reports(user_id: str):
    _ = user_id
    return {"reports": MOCK_REPORTS}

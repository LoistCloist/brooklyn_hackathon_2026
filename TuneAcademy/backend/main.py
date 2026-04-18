"""MusiLearn API stub — PRD §6. Essentia wiring comes post-hackathon."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import analyze, reports

app = FastAPI(title="MusiLearn API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "ok"}

"""MusiLearn API — Essentia-powered audio analysis backend."""

from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import analyze, reports, tracks
import reference_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    reference_store.load_all()
    yield


app = FastAPI(title="MusiLearn API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(reports.router)
app.include_router(tracks.router)


@app.get("/health")
def health():
    return {"status": "ok"}

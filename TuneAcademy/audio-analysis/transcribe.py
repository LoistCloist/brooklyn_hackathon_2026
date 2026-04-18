"""Convert user audio to note events using Basic Pitch."""

import os
import tempfile
from dataclasses import dataclass

import numpy as np


@dataclass
class NoteEvent:
    time: float        # onset in seconds
    duration: float    # length in seconds
    pitch: float       # MIDI pitch (e.g. 64.0 = E4)
    confidence: float  # 0.0–1.0


def transcribe_wav(wav_bytes: bytes) -> list[NoteEvent]:
    """
    Run Basic Pitch on raw WAV bytes and return a list of NoteEvents.
    Format matches GuitarSet JAMS note_midi namespace for direct comparison.
    """
    from basic_pitch.inference import predict
    from basic_pitch import ICASSP_2022_MODEL_PATH

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        tmp_path = f.name

    try:
        _, _, note_events = predict(tmp_path, ICASSP_2022_MODEL_PATH)
    finally:
        os.unlink(tmp_path)

    # note_events columns: start_time, end_time, pitch_midi, amplitude, pitch_bend
    return [
        NoteEvent(
            time=float(row[0]),
            duration=float(row[1]) - float(row[0]),
            pitch=float(row[2]),
            confidence=float(row[3]),
        )
        for row in note_events
    ]

"""
Compare user audio against a MIDI reference using Essentia pitch contour alignment.

Pipeline:
  1. Convert MIDI NoteEvents to a frame-level pitch schedule (MIDI pitch units, one value per
     Essentia hop).
  2. Extract the user's pitch contour from WAV bytes using Essentia PitchYinFFT — the same
     extractor already used for the standalone quality scores in analyze.py.
  3. DTW-align the two voiced pitch sequences and compute accuracy metrics.

No audio synthesis or Basic Pitch transcription is involved.
"""

import os
import tempfile
from dataclasses import dataclass

import numpy as np

from transcribe import NoteEvent

_SR = 44100
_FRAME_SIZE = 2048
_HOP_SIZE = 512
_SEMITONE_TOLERANCE = 1.0
_CONF_THRESHOLD = 0.4
_DOWNSAMPLE = 8  # use every Nth voiced frame to keep DTW fast for long recordings


@dataclass
class ComparisonResult:
    note_accuracy: int
    timing_accuracy: int
    missed_notes: int
    extra_notes: int
    total_reference_notes: int


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _hz_to_midi(hz: float) -> float:
    if hz <= 0:
        return 0.0
    return 12.0 * float(np.log2(hz / 440.0)) + 69.0


def _notes_to_pitch_schedule(notes: list[NoteEvent], n_frames: int) -> np.ndarray:
    """
    Build a frame-level pitch schedule from MIDI note events.
    Each frame index i covers time i * _HOP_SIZE / _SR seconds.
    Frames with no active note stay 0.0.
    """
    schedule = np.zeros(n_frames, dtype=np.float32)
    for note in notes:
        start = int(note.time * _SR / _HOP_SIZE)
        end = int((note.time + note.duration) * _SR / _HOP_SIZE)
        schedule[max(0, start):min(n_frames, end)] = float(note.pitch)
    return schedule


def _extract_pitch_contour(wav_bytes: bytes) -> tuple[np.ndarray, np.ndarray]:
    """
    Run Essentia PitchYinFFT on raw WAV bytes.
    Returns (pitches_midi, confidences), one value per hop frame.
    Unvoiced frames (conf <= threshold or hz <= 20) get pitch 0.0.
    """
    import essentia.standard as es

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        tmp = f.name
    try:
        audio = es.MonoLoader(filename=tmp, sampleRate=_SR)()
    finally:
        os.unlink(tmp)

    windowing = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=_FRAME_SIZE)
    pitch_yin = es.PitchYinFFT(frameSize=_FRAME_SIZE, sampleRate=_SR)

    pitches, confs = [], []
    for frame in es.FrameGenerator(audio, frameSize=_FRAME_SIZE, hopSize=_HOP_SIZE, startFromZero=True):
        hz, conf = pitch_yin(spectrum(windowing(frame)))
        pitched = conf > _CONF_THRESHOLD and hz > 20
        pitches.append(_hz_to_midi(hz) if pitched else 0.0)
        confs.append(float(conf))

    return np.array(pitches, dtype=np.float32), np.array(confs, dtype=np.float32)


def _dtw(ref: np.ndarray, user: np.ndarray) -> tuple[float, list[tuple[int, int]]]:
    n, m = len(ref), len(user)
    cost = np.full((n + 1, m + 1), np.inf, dtype=np.float32)
    cost[0, 0] = 0.0

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d = abs(ref[i - 1] - user[j - 1])
            cost[i, j] = d + min(cost[i - 1, j], cost[i, j - 1], cost[i - 1, j - 1])

    path: list[tuple[int, int]] = []
    i, j = n, m
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        diag, left, up = cost[i - 1, j - 1], cost[i, j - 1], cost[i - 1, j]
        best = min(diag, left, up)
        if best == diag:
            i -= 1; j -= 1
        elif best == left:
            j -= 1
        else:
            i -= 1
    path.reverse()

    normalized = float(cost[n, m]) / (n + m) if (n + m) > 0 else 0.0
    return normalized, path


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compare(reference: list[NoteEvent], wav_bytes: bytes) -> ComparisonResult:
    """
    Compare user WAV recording against MIDI reference note events.
    Returns accuracy metrics using Essentia pitch extraction throughout.
    """
    if not reference:
        return ComparisonResult(
            note_accuracy=0,
            timing_accuracy=0,
            missed_notes=0,
            extra_notes=0,
            total_reference_notes=0,
        )

    # --- Step 1: user pitch contour via Essentia ---
    user_midi, user_confs = _extract_pitch_contour(wav_bytes)
    n_user_frames = len(user_midi)

    # --- Step 2: reference pitch schedule clipped to a reasonable window ---
    ref_end_sec = max(n.time + n.duration for n in reference)
    # Allow up to 1.5× the user recording length so DTW can find alignment
    # even if user starts slightly early, but don't load the entire song.
    clip_sec = (n_user_frames * _HOP_SIZE / _SR) * 1.5
    n_ref_frames = int(min(ref_end_sec, clip_sec) * _SR / _HOP_SIZE) + 1
    ref_schedule = _notes_to_pitch_schedule(reference, n_ref_frames)

    # --- Step 3: keep only voiced frames, then downsample ---
    ref_voiced_full = ref_schedule[ref_schedule > 0]
    total_voiced = len(ref_voiced_full)
    ref_voiced = ref_voiced_full[::_DOWNSAMPLE]

    user_voiced = user_midi[user_confs > _CONF_THRESHOLD][::_DOWNSAMPLE]

    if len(ref_voiced) == 0 or len(user_voiced) == 0:
        return ComparisonResult(
            note_accuracy=0,
            timing_accuracy=0,
            missed_notes=total_voiced,
            extra_notes=len(user_voiced),
            total_reference_notes=total_voiced,
        )

    # Bound reference to avoid O(n*m) blowup when ref >> user
    ref_voiced = ref_voiced[: len(user_voiced) * 3]

    # --- Step 4: DTW and score ---
    normalized_cost, path = _dtw(ref_voiced, user_voiced)

    matched_ref: set[int] = set()
    matched_user: set[int] = set()
    for ri, ui in path:
        if abs(ref_voiced[ri] - user_voiced[ui]) <= _SEMITONE_TOLERANCE:
            matched_ref.add(ri)
            matched_user.add(ui)

    matched = len(matched_ref)
    note_accuracy = int(round(matched / len(ref_voiced) * 100))
    timing_accuracy = int(max(0, min(100, (1.0 - normalized_cost / 12.0) * 100)))

    return ComparisonResult(
        note_accuracy=note_accuracy,
        timing_accuracy=timing_accuracy,
        missed_notes=len(ref_voiced) - matched,
        extra_notes=max(0, len(user_voiced) - len(matched_user)),
        total_reference_notes=total_voiced,
    )

"""POST /analyze — Essentia-powered WAV audio analysis."""

import os
import tempfile

import numpy as np
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

router = APIRouter(tags=["analyze"])

_WEAK_THRESHOLD = 65
_SR = 44100

_WEAKNESS_MESSAGES = {
    "pitch_centre": "Pitch accuracy is low — focus on tuning and hitting target notes cleanly.",
    "pitch_stability": "Pitch wavers during sustained notes — practice long-tone exercises to improve control.",
    "rhythm": "Rhythmic consistency needs work — try playing with a metronome to tighten your timing.",
    "tone_quality": "Tone sounds noisy or unclear — check instrument setup and pick/bow technique.",
    "note_attack": "Note attacks are soft or unclear — work on consistent, decisive note starts.",
}


def _load_audio(wav_bytes: bytes):
    """Write bytes to a temp file and load as mono float32 array at _SR."""
    import essentia.standard as es

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        tmp = f.name
    try:
        audio = es.MonoLoader(filename=tmp, sampleRate=_SR)()
    finally:
        os.unlink(tmp)
    return audio


def _pitch_scores(audio) -> tuple[int, int]:
    """
    Uses PitchYinFFT on windowed spectrum frames.
    Returns (pitch_centre_score, pitch_stability_score) in [0, 100].
    """
    import essentia.standard as es

    frame_size, hop_size = 2048, 512
    windowing = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=frame_size)
    pitch_yin_fft = es.PitchYinFFT(frameSize=frame_size, sampleRate=_SR)

    pitches, confs = [], []
    for frame in es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size, startFromZero=True):
        spec = spectrum(windowing(frame))
        pitch, conf = pitch_yin_fft(spec)
        if conf > 0.4 and pitch > 20:
            pitches.append(pitch)
            confs.append(conf)

    if not confs:
        return 50, 50

    centre = int(min(100, float(np.mean(confs)) * 105))

    if len(pitches) < 2:
        stability = 50
    else:
        arr = np.array(pitches, dtype=np.float32)
        cv = float(np.std(arr) / (np.mean(arr) + 1e-6))
        stability = int(max(0, min(100, 100 - cv * 400)))

    return centre, stability


def _rhythm_score(audio) -> int:
    import essentia.standard as es

    try:
        bpm, ticks, confidence, estimates, bpm_intervals = es.RhythmExtractor2013(method="multifeature")(audio)
        return int(min(100, float(confidence) * 100))
    except Exception:
        return 50


def _tone_quality_score(audio) -> int:
    """
    Spectral flatness per frame; 0 = pure tone (good), 1 = white noise (bad).
    Score = (1 - mean_flatness) * 100.
    """
    import essentia.standard as es

    frame_size, hop_size = 2048, 512
    windowing = es.Windowing(type="blackmanharris62")
    spectrum = es.Spectrum(size=frame_size)
    flatness = es.Flatness()

    vals = [
        flatness(spectrum(windowing(frame)))
        for frame in es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size, startFromZero=True)
    ]
    if not vals:
        return 50
    return int(max(0, min(100, (1.0 - float(np.mean(vals))) * 100)))


def _note_attack_score(audio) -> int:
    """
    95th-percentile RMS energy rise divided by mean energy.
    Sharp attacks produce high ratios → high score.
    """
    import essentia.standard as es

    frame_size, hop_size = 1024, 256
    rms = es.RMS()

    energies = np.array(
        [rms(f) for f in es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size, startFromZero=True)],
        dtype=np.float32,
    )
    if len(energies) < 3:
        return 50

    pos_diffs = np.diff(energies)
    pos_diffs = pos_diffs[pos_diffs > 0]
    if len(pos_diffs) == 0:
        return 50

    ratio = float(np.percentile(pos_diffs, 95)) / (float(np.mean(energies)) + 1e-9)
    return int(min(100, ratio * 25))


def _analyze_audio(wav_bytes: bytes, instrument: str) -> dict:
    audio = _load_audio(wav_bytes)

    if len(audio) < 2048:
        raise ValueError("Audio too short for analysis (minimum ~46 ms at 44.1 kHz)")

    pitch_centre, pitch_stability = _pitch_scores(audio)
    scores = {
        "pitch_centre": pitch_centre,
        "pitch_stability": pitch_stability,
        "rhythm": _rhythm_score(audio),
        "tone_quality": _tone_quality_score(audio),
        "note_attack": _note_attack_score(audio),
    }

    overall = int(round(sum(scores.values()) / len(scores)))
    weaknesses = [msg for dim, msg in _WEAKNESS_MESSAGES.items() if scores[dim] < _WEAK_THRESHOLD]

    return {
        "instrument": instrument,
        "overall_score": overall,
        "dimension_scores": scores,
        "weaknesses": weaknesses,
    }


@router.post("/analyze")
async def analyze(
    instrument: str = Form("guitar"),
    reference_id: str | None = Form(default=None),
    audio: UploadFile | None = File(default=None),
    authorization: str | None = Header(None),
):
    _ = authorization
    if audio is None:
        raise HTTPException(status_code=400, detail="No audio file provided")

    wav_bytes = await audio.read()
    if not wav_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    try:
        result = _analyze_audio(wav_bytes, instrument or "guitar")

        if reference_id:
            import reference_store
            from transcribe import transcribe_wav
            from compare import compare

            try:
                reference_notes = reference_store.get_notes(reference_id)
                user_notes = transcribe_wav(wav_bytes)
                comparison = compare(reference_notes, user_notes)
                result["comparison"] = {
                    "reference_id": reference_id,
                    "note_accuracy": comparison.note_accuracy,
                    "timing_accuracy": comparison.timing_accuracy,
                    "missed_notes": comparison.missed_notes,
                    "extra_notes": comparison.extra_notes,
                    "total_reference_notes": comparison.total_reference_notes,
                }
            except KeyError as exc:
                raise HTTPException(status_code=404, detail=str(exc)) from exc

        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

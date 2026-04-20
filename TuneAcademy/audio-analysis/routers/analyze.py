"""POST /analyze — Essentia-powered WAV audio analysis."""

import os
import tempfile

import numpy as np
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

router = APIRouter(tags=["analyze"])

_WEAK_THRESHOLD = 65
_SR = 44100

_BASE_WEIGHTS = {
    "pitch_centre": 0.20,
    "pitch_stability": 0.25,
    "rhythm": 0.25,
    "tone_quality": 0.20,
    "note_attack": 0.10,
}

_PIANO_WEIGHTS = {
    "pitch_centre": 0.20,
    "pitch_stability": 0.20,
    "rhythm": 0.35,
    "tone_quality": 0.25,
}

_REFERENCE_WEIGHTS = {
    "note_accuracy": 0.40,
    "rhythm": 0.30,
    "tone_quality": 0.20,
    "pitch_stability": 0.10,
}

_WEAKNESS_MESSAGES = {
    "pitch_centre": "Pitch accuracy is low — focus on tuning and hitting target notes cleanly.",
    "pitch_stability": "Pitch wavers during sustained notes — practice long-tone exercises to improve control.",
    "rhythm": "Rhythmic consistency needs work — try playing with a metronome to tighten your timing.",
    "tone_quality": "Tone sounds noisy or unclear — check instrument setup and pick/bow technique.",
    "note_attack": "Note attacks are soft or unclear — work on consistent, decisive note starts.",
}


_WEAKNESS_MESSAGES["note_accuracy"] = (
    "Note accuracy is low - slow the passage down and focus on matching the reference pitches."
)


def _is_piano(instrument: str) -> bool:
    return instrument.strip().lower() == "piano"


def _weighted_score(scores: dict[str, int], weights: dict[str, float]) -> int:
    available = {key: weight for key, weight in weights.items() if key in scores}
    total_weight = sum(available.values())
    if total_weight <= 0:
        return int(round(sum(scores.values()) / len(scores))) if scores else 0
    weighted = sum(scores[key] * weight for key, weight in available.items()) / total_weight
    return int(round(max(0, min(100, weighted))))


def _overall_score(scores: dict[str, int], instrument: str) -> int:
    if "note_accuracy" in scores:
        return _weighted_score(scores, _REFERENCE_WEIGHTS)
    if _is_piano(instrument):
        return _weighted_score(scores, _PIANO_WEIGHTS)
    return _weighted_score(scores, _BASE_WEIGHTS)


def _weaknesses(scores: dict[str, int], instrument: str) -> list[str]:
    ignored = {"note_attack"} if _is_piano(instrument) else set()
    if "note_accuracy" in scores:
        ignored.update({"note_attack", "pitch_centre"})
    return [
        msg
        for dim, msg in _WEAKNESS_MESSAGES.items()
        if dim in scores and dim not in ignored and scores[dim] < _WEAK_THRESHOLD
    ]


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
        midi = 12.0 * np.log2(arr / 440.0 + 1e-9) + 69.0
        diffs = np.abs(np.diff(midi))
        within_note = diffs[diffs < 0.5]  # ignore note transitions (>0.5 semitone)
        if len(within_note) == 0:
            stability = 100
        else:
            mean_wobble = float(np.mean(within_note))  # semitones
            stability = int(max(0, min(100, 100 - mean_wobble * 200)))

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

    return {
        "instrument": instrument,
        "overall_score": _overall_score(scores, instrument),
        "dimension_scores": scores,
        "weaknesses": _weaknesses(scores, instrument),
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
        result = _analyze_audio(wav_bytes, instrument or "voice")

        if reference_id:
            import reference_store
            from compare import compare

            try:
                reference_notes = reference_store.get_notes(reference_id)
                comparison = compare(reference_notes, wav_bytes)
                result["comparison"] = {
                    "reference_id": reference_id,
                    **comparison.__dict__,
                }
                result["dimension_scores"]["note_accuracy"] = comparison.note_accuracy
                result["dimension_scores"]["rhythm"] = comparison.timing_accuracy
                result["overall_score"] = _overall_score(result["dimension_scores"], instrument or "voice")
                result["weaknesses"] = _weaknesses(result["dimension_scores"], instrument or "voice")
            except KeyError as exc:
                print(f"[analyze] reference track not found, skipping comparison: {exc}")
                result["comparison_error"] = str(exc)
            except Exception as exc:
                print(f"[analyze] comparison skipped: {exc}")
                result["comparison_error"] = str(exc)

        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

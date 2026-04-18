"""
DTW-based comparison of user note events against a GuitarSet reference.

Returns note accuracy, timing accuracy, and missed/extra note counts.
"""

import numpy as np
from dataclasses import dataclass

from transcribe import NoteEvent

_SEMITONE_TOLERANCE = 1.0  # notes within 1 semitone count as a match


@dataclass
class ComparisonResult:
    note_accuracy: int       # 0-100: % of reference notes user hit
    timing_accuracy: int     # 0-100: how well timing aligned
    missed_notes: int        # reference notes user didn't play
    extra_notes: int         # user notes not in reference
    total_reference_notes: int


def _notes_to_array(notes: list[NoteEvent]) -> np.ndarray:
    """Convert note events to (time, pitch) array."""
    if not notes:
        return np.empty((0, 2), dtype=np.float32)
    return np.array([[n.time, n.pitch] for n in notes], dtype=np.float32)


def _dtw_cost(ref: np.ndarray, user: np.ndarray) -> tuple[float, list[tuple[int, int]]]:
    """
    Compute DTW between ref and user pitch sequences.
    Returns (normalized_cost, warping_path).
    Cost is based on pitch distance only — time is handled by the warping.
    """
    n, m = len(ref), len(user)
    cost_matrix = np.full((n + 1, m + 1), np.inf, dtype=np.float32)
    cost_matrix[0, 0] = 0.0

    ref_pitch = ref[:, 1]
    user_pitch = user[:, 1]

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            pitch_dist = abs(float(ref_pitch[i - 1]) - float(user_pitch[j - 1]))
            cost_matrix[i, j] = pitch_dist + min(
                cost_matrix[i - 1, j],      # deletion (missed note)
                cost_matrix[i, j - 1],      # insertion (extra note)
                cost_matrix[i - 1, j - 1],  # match
            )

    # Trace back the warping path
    path = []
    i, j = n, m
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        diag = cost_matrix[i - 1, j - 1]
        left = cost_matrix[i, j - 1]
        up = cost_matrix[i - 1, j]
        best = min(diag, left, up)
        if best == diag:
            i -= 1
            j -= 1
        elif best == left:
            j -= 1
        else:
            i -= 1

    path.reverse()
    normalized = float(cost_matrix[n, m]) / (n + m) if (n + m) > 0 else 0.0
    return normalized, path


def _score_matches(
    ref: np.ndarray,
    user: np.ndarray,
    path: list[tuple[int, int]],
) -> tuple[int, int, int]:
    """
    Walk the warping path and count matched, missed, and extra notes.
    Returns (matched_count, missed_count, extra_count).
    """
    matched_ref = set()
    matched_user = set()

    for ri, ui in path:
        pitch_dist = abs(float(ref[ri, 1]) - float(user[ui, 1]))
        if pitch_dist <= _SEMITONE_TOLERANCE:
            matched_ref.add(ri)
            matched_user.add(ui)

    matched = len(matched_ref)
    missed = len(ref) - matched
    extra = len(user) - len(matched_user)
    return matched, missed, max(0, extra)


def compare(
    reference: list[NoteEvent],
    user_notes: list[NoteEvent],
) -> ComparisonResult:
    if not reference:
        return ComparisonResult(
            note_accuracy=0,
            timing_accuracy=0,
            missed_notes=0,
            extra_notes=len(user_notes),
            total_reference_notes=0,
        )

    if not user_notes:
        return ComparisonResult(
            note_accuracy=0,
            timing_accuracy=0,
            missed_notes=len(reference),
            extra_notes=0,
            total_reference_notes=len(reference),
        )

    ref_arr = _notes_to_array(reference)
    user_arr = _notes_to_array(user_notes)

    normalized_cost, path = _dtw_cost(ref_arr, user_arr)
    matched, missed, extra = _score_matches(ref_arr, user_arr, path)

    note_accuracy = int(round(matched / len(reference) * 100))

    # DTW cost of 0 = perfect timing, cost of 12 (one octave avg error) = 0 score
    timing_accuracy = int(max(0, min(100, (1.0 - normalized_cost / 12.0) * 100)))

    return ComparisonResult(
        note_accuracy=note_accuracy,
        timing_accuracy=timing_accuracy,
        missed_notes=missed,
        extra_notes=extra,
        total_reference_notes=len(reference),
    )

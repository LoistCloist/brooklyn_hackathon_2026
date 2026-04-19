from dataclasses import dataclass


@dataclass
class NoteEvent:
    time: float        # onset in seconds
    duration: float    # length in seconds
    pitch: float       # MIDI pitch (e.g. 64.0 = E4)
    confidence: float  # 0.0–1.0

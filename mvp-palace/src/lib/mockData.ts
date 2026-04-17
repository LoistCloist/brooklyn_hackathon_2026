export type Instrument = "Voice" | "Guitar" | "Piano" | "Saxophone" | "Violin" | "Drums" | "Bass";

export type DimensionScores = { 
  pitch_centre: number;
  pitch_stability: number;
  rhythm: number;
  tone_quality: number;
  note_attack: number;
};

export type Report = {
  id: string;
  date: string; // ISO
  instrument: Instrument;
  overall_score: number;
  dimension_scores: DimensionScores;
  weaknesses: string[];
};

export type Instructor = {
  id: string;
  name: string;
  avatar: string; // initials fallback
  specialties: Instrument[];
  rating: number;
  reviewsCount: number;
  hourlyRate: number; // 0 = Free
  bio: string;
  yearsExp: number;
  addresses: string[]; // weakness tags they help with
};

export type Reel = {
  id: string;
  username: string;
  instrument: Instrument;
  caption: string;
  likes: number;
  comments: number;
  hue: number; // for placeholder gradient
};

export type Review = {
  id: string;
  reviewer: string;
  rating: number;
  comment: string;
  date: string;
};

export const learnerProfile = {
  fullName: "Jordan",
  avatarInitials: "JD",
  primaryInstrument: "Guitar" as Instrument,
};

export const dashboardStats = {
  lessonsTaken: 12,
  videosPosted: 4,
  upcomingSession: "Apr 22 · 5:00 PM",
  overallScore: 72,
};

export const progressSeries = [58, 61, 64, 67, 70, 72];

export const recentReport: Report = {
  id: "r_001",
  date: "2026-04-15",
  instrument: "Guitar",
  overall_score: 72,
  dimension_scores: {
    pitch_centre: 85,
    pitch_stability: 60,
    rhythm: 90,
    tone_quality: 55,
    note_attack: 78,
  },
  weaknesses: [
    "Pitch is unstable — check fretting pressure and finger placement.",
    "Tone quality differs from reference — possible string buzz.",
  ],
};

export const instructors: Instructor[] = [
  {
    id: "i_01",
    name: "Maya Hart",
    avatar: "MH",
    specialties: ["Guitar", "Bass"],
    rating: 4.9,
    reviewsCount: 38,
    hourlyRate: 45,
    bio: "Berklee grad. 10+ yrs teaching electric & acoustic. Patient with beginners.",
    yearsExp: 11,
    addresses: ["Pitch Stability", "Tone Quality"],
  },
  {
    id: "i_02",
    name: "Daniel Okafor",
    avatar: "DO",
    specialties: ["Piano"],
    rating: 4.8,
    reviewsCount: 24,
    hourlyRate: 60,
    bio: "Classical pianist & composer. Specialises in technique and sight-reading.",
    yearsExp: 14,
    addresses: ["Rhythm", "Note Attack"],
  },
  {
    id: "i_03",
    name: "Sora Tanaka",
    avatar: "ST",
    specialties: ["Voice"],
    rating: 5.0,
    reviewsCount: 51,
    hourlyRate: 0,
    bio: "Vocal coach for indie & jazz. First lesson free.",
    yearsExp: 8,
    addresses: ["Pitch Centre", "Pitch Stability"],
  },
  {
    id: "i_04",
    name: "Lukas Berger",
    avatar: "LB",
    specialties: ["Saxophone"],
    rating: 4.7,
    reviewsCount: 19,
    hourlyRate: 50,
    bio: "Tenor sax player, 7 yrs gigging in Berlin. Loves jazz fundamentals.",
    yearsExp: 7,
    addresses: ["Tone Quality"],
  },
  {
    id: "i_05",
    name: "Priya Anand",
    avatar: "PA",
    specialties: ["Violin"],
    rating: 4.9,
    reviewsCount: 33,
    hourlyRate: 55,
    bio: "Royal Academy alum. Gentle, structured method for adult learners.",
    yearsExp: 12,
    addresses: ["Pitch Stability", "Note Attack"],
  },
  {
    id: "i_06",
    name: "Marcus Reed",
    avatar: "MR",
    specialties: ["Drums"],
    rating: 4.6,
    reviewsCount: 22,
    hourlyRate: 40,
    bio: "Studio drummer. Focus on groove, dynamics, and time-feel.",
    yearsExp: 9,
    addresses: ["Rhythm"],
  },
];

export const reviewsByInstructor: Record<string, Review[]> = {
  i_01: [
    { id: "rv1", reviewer: "Alex P.", rating: 5, comment: "Maya transformed my fingerpicking in three sessions.", date: "2026-03-12" },
    { id: "rv2", reviewer: "Sam W.", rating: 5, comment: "Clear, patient, and motivating.", date: "2026-02-20" },
    { id: "rv3", reviewer: "Riya N.", rating: 4, comment: "Great for intermediate players.", date: "2026-01-30" },
  ],
};

export const reels: Reel[] = [
  { id: "rl1", username: "@noahplays", instrument: "Guitar", caption: "Trying out a new lick 🎸", likes: 1240, comments: 88, hue: 0 },
  { id: "rl2", username: "@elenakeys", instrument: "Piano", caption: "Chopin nocturne — first take", likes: 3420, comments: 210, hue: 30 },
  { id: "rl3", username: "@sax_sam", instrument: "Saxophone", caption: "Late night tone practice", likes: 980, comments: 44, hue: 220 },
  { id: "rl4", username: "@violet.v", instrument: "Violin", caption: "Bach partita excerpt", likes: 2150, comments: 132, hue: 280 },
  { id: "rl5", username: "@drumdad", instrument: "Drums", caption: "Linear groove study", likes: 760, comments: 28, hue: 120 },
  { id: "rl6", username: "@vox.lila", instrument: "Voice", caption: "Sustained C4 — feedback welcome", likes: 1890, comments: 75, hue: 340 },
  { id: "rl7", username: "@bass.kai", instrument: "Bass", caption: "Slap pattern in E minor", likes: 540, comments: 18, hue: 180 },
  { id: "rl8", username: "@maria.g", instrument: "Guitar", caption: "Jazz chord melody", likes: 1320, comments: 60, hue: 60 },
];

export const challenges: Record<string, { instrument: Instrument; text: string }> = {
  voice: { instrument: "Voice", text: "Sing middle C (C4) for 3 seconds" },
  guitar: { instrument: "Guitar", text: "Play open E, then fret G on string 1" },
  piano: { instrument: "Piano", text: "Play a C major scale, 1 octave" },
  saxophone: { instrument: "Saxophone", text: "Sustain a concert B♭ for 3 seconds" },
};

export const dimensionLabels: { key: keyof DimensionScores; label: string }[] = [
  { key: "pitch_centre", label: "Pitch Centre" },
  { key: "pitch_stability", label: "Pitch Stability" },
  { key: "rhythm", label: "Rhythm" },
  { key: "tone_quality", label: "Tone Quality" },
  { key: "note_attack", label: "Note Attack" },
];

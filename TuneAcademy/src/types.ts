import type { Timestamp } from "firebase/firestore";

export interface Reel {
  id: string;
  uploaderId: string;
  uploaderName: string;
  uploaderAvatarUrl: string;
  instrument: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  likedBy: string[];
  createdAt: Timestamp;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  text: string;
  createdAt: Timestamp;
}

export interface Invitation {
  id: string;
  instructorId: string;
  instructorName: string;
  learnerId: string;
  /** Denormalized for UI; optional on older documents */
  learnerName?: string;
  reelId: string;
  message: string;
  status: "pending" | "accepted" | "declined";
  createdAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
}

export interface AnalysisReport {
  id: string;
  userId: string;
  instrument: string;
  challenge: string;
  status: "pending" | "done" | "error";
  overallScore?: number;
  overall_score?: number;
  dimensionScores?: {
    note_accuracy?: number;
    pitch_centre: number;
    pitch_stability: number;
    rhythm: number;
    tone_quality: number;
    note_attack: number;
  };
  dimension_scores?: {
    note_accuracy?: number;
    pitch_centre: number;
    pitch_stability: number;
    rhythm: number;
    tone_quality: number;
    note_attack: number;
  };
  weaknesses?: string[];
  comparison?: {
    reference_id?: string;
    note_accuracy?: number;
    timing_accuracy?: number;
    missed_notes?: number;
    extra_notes?: number;
    total_reference_notes?: number;
  };
  comparison_error?: string;
  error?: string;
  createdAt: Timestamp;
  analyzedAt?: Timestamp;
}

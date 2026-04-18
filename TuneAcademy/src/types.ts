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

/**
 * Re-exports Firestore document types for code paths that still import the
 * legacy "MusiLearn" module name after project merges.
 */
export type {
  InstructorFirestoreDoc,
  UserFirestoreDoc,
  UserRole,
} from "@/lib/tuneacademyFirestore";

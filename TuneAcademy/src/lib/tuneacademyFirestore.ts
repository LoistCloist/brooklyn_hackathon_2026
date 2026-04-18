import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage, getFirestoreDb } from "@/lib/firebase";
import type { WeeklyTimeSlot } from "@/lib/scheduling";
import { slotKey } from "@/lib/scheduling";

/** PRD: /users/{userId} */
export type UserRole = "learner" | "instructor";

export type UserFirestoreDoc = {
  role: UserRole;
  fullName: string;
  email: string;
  avatarUrl: string;
  /** Learner-written bio; stored on `users/{uid}` for students. */
  bio?: string;
  createdAt?: unknown;
};

/** PRD: /instructors/{userId} */
export type InstructorFirestoreDoc = {
  fullName: string;
  avatarUrl: string;
  age: number;
  experienceYears: number;
  nationality?: string;
  specialties: string[];
  bio: string;
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  /** Recurring hour blocks learners can request (see `WeeklyTimeSlot`). */
  weeklyAvailability?: WeeklyTimeSlot[];
  /** Upper bound learners can pick when requesting multi-week tutoring. */
  maxTutoringWeeks?: number;
};

export function specialtyToSlug(label: string): string {
  return label.trim().toLowerCase();
}

export async function createUserFirestoreDoc(
  uid: string,
  data: { role: UserRole; fullName: string; email: string },
): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, "users", uid), {
    role: data.role,
    fullName: data.fullName,
    email: data.email,
    avatarUrl: "",
    createdAt: serverTimestamp(),
  });
}

export async function getUserDoc(uid: string): Promise<UserFirestoreDoc | null> {
  const snap = await getDoc(doc(getFirestoreDb(), "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserFirestoreDoc;
}

export const LEARNER_BIO_MAX_CHARS = 500;

export async function updateLearnerBio(uid: string, bio: string): Promise<void> {
  const trimmed = bio.trim();
  if (trimmed.length > LEARNER_BIO_MAX_CHARS) {
    throw new Error(`Bio must be ${LEARNER_BIO_MAX_CHARS} characters or less.`);
  }
  await updateDoc(doc(getFirestoreDb(), "users", uid), {
    bio: trimmed,
  });
}

export async function getInstructorDoc(uid: string): Promise<InstructorFirestoreDoc | null> {
  const snap = await getDoc(doc(getFirestoreDb(), "instructors", uid));
  if (!snap.exists()) return null;
  return snap.data() as InstructorFirestoreDoc;
}

export function instructorOnboardingComplete(inst: InstructorFirestoreDoc | null): boolean {
  return Boolean(inst?.bio?.trim());
}

export async function resolvePostLoginPath(uid: string): Promise<"/app" | "/onboarding"> {
  const user = await getUserDoc(uid);
  if (!user) return "/app";
  if (user.role !== "instructor") return "/app";
  const inst = await getInstructorDoc(uid);
  return instructorOnboardingComplete(inst) ? "/app" : "/onboarding";
}

export async function uploadInstructorAvatar(uid: string, file: File): Promise<string> {
  const storage = getFirebaseStorage();
  const objectRef = ref(storage, `avatars/${uid}/profile`);
  await uploadBytes(objectRef, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(objectRef);
}

export async function saveInstructorOnboarding(
  uid: string,
  payload: {
    fullName: string;
    avatarUrl: string;
    age: number;
    experienceYears: number;
    nationality: string;
    specialties: string[];
    bio: string;
    hourlyRate: number;
    weeklyAvailability: WeeklyTimeSlot[];
    maxTutoringWeeks: number;
  },
): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, "instructors", uid), {
    fullName: payload.fullName,
    avatarUrl: payload.avatarUrl,
    age: payload.age,
    experienceYears: payload.experienceYears,
    nationality: payload.nationality,
    specialties: payload.specialties,
    bio: payload.bio,
    hourlyRate: payload.hourlyRate,
    weeklyAvailability: payload.weeklyAvailability,
    maxTutoringWeeks: payload.maxTutoringWeeks,
    rating: 0,
    reviewCount: 0,
  });

  await updateDoc(doc(db, "users", uid), {
    fullName: payload.fullName,
    avatarUrl: payload.avatarUrl,
  });
}

export async function updateInstructorScheduleSettings(
  uid: string,
  payload: { weeklyAvailability: WeeklyTimeSlot[]; maxTutoringWeeks: number },
): Promise<void> {
  const weeks = Math.min(52, Math.max(1, Math.floor(payload.maxTutoringWeeks)));
  const slots = payload.weeklyAvailability.filter(
    (s) =>
      s.weekday >= 0 &&
      s.weekday <= 6 &&
      s.startMinute >= 0 &&
      s.endMinute > s.startMinute &&
      s.endMinute <= 24 * 60,
  );
  const dedupKeys = new Set<string>();
  const weeklyAvailability = slots.filter((s) => {
    const k = slotKey(s);
    if (dedupKeys.has(k)) return false;
    dedupKeys.add(k);
    return true;
  });
  await updateDoc(doc(getFirestoreDb(), "instructors", uid), {
    weeklyAvailability,
    maxTutoringWeeks: weeks,
  });
}

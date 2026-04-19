import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage, getFirestoreDb } from "@/lib/firebase";
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
  /** Learner: total tutoring budget cap (USD). Omitted = not configured. */
  learningBudgetCapUsd?: number;
  /** Learner: total spent from completed sessions (USD), incremented by TuneAcademy. */
  learningBudgetSpentUsd?: number;
  createdAt?: unknown;
};

/** PRD: /instructors/{userId} */
/** Learner-submitted review; path `instructors/{instructorId}/receivedReviews/{reviewId}`. */
export type InstructorReceivedReviewDoc = {
  learnerId: string;
  stars: number;
  reviewText?: string;
  engagementId?: string;
  sessionIndex?: number;
  createdAt?: unknown;
};

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
    ...(data.role === "learner" ? { learningBudgetSpentUsd: 0 } : {}),
    createdAt: serverTimestamp(),
  });
}

/**
 * Session reviews require `users/{uid}` for security rules. Creates a minimal learner profile when
 * missing (e.g. account existed before Firestore onboarding).
 */
export async function ensureSignedInLearnerUserDocForReview(): Promise<void> {
  const u = getFirebaseAuth().currentUser;
  if (!u) throw new Error("You must be signed in to submit a review.");
  const db = getFirestoreDb();
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const role = (snap.data() as { role?: UserRole }).role;
    if (role === "instructor") {
      throw new Error("Only students can submit session reviews.");
    }
    return;
  }
  await setDoc(ref, {
    role: "learner",
    fullName: u.displayName?.trim() || "Student",
    email: u.email?.trim() || "",
    avatarUrl: "",
    learningBudgetSpentUsd: 0,
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

const LEARNER_BUDGET_MAX_USD = 1_000_000;

export async function updateLearnerBudgetCap(uid: string, capUsd: number): Promise<void> {
  if (!Number.isFinite(capUsd) || capUsd < 0) {
    throw new Error("Budget must be zero or a positive number.");
  }
  const rounded = Math.round(capUsd * 100) / 100;
  if (rounded > LEARNER_BUDGET_MAX_USD) {
    throw new Error(`Budget cannot exceed ${LEARNER_BUDGET_MAX_USD.toLocaleString()} USD.`);
  }
  await updateDoc(doc(getFirestoreDb(), "users", uid), {
    learningBudgetCapUsd: rounded,
  });
}

const REVIEW_TEXT_MAX = 2000;

export async function submitInstructorSessionReview(args: {
  instructorId: string;
  learnerId: string;
  engagementId: string;
  sessionIndex: number;
  stars: number;
  reviewText: string;
}): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth.currentUser?.uid !== args.learnerId) {
    throw new Error("You must be signed in as the student who took this session.");
  }
  await ensureSignedInLearnerUserDocForReview();

  const s = Math.round(Math.min(5, Math.max(1, Number(args.stars))));
  if (!Number.isFinite(s) || s < 1 || s > 5) throw new Error("Stars must be between 1 and 5.");
  const sessionIdx = Math.floor(Math.max(0, Number(args.sessionIndex)));
  if (!Number.isFinite(sessionIdx)) throw new Error("Invalid session.");
  const text = args.reviewText.trim().slice(0, REVIEW_TEXT_MAX);
  const engagementKey = args.engagementId.trim();
  /** Must match Firestore rules `reviewId` pattern (string index). */
  const reviewId = `${args.learnerId}_${engagementKey}_${String(sessionIdx)}`;
  const db = getFirestoreDb();

  await runTransaction(db, async (tx) => {
    const revRef = doc(db, "instructors", args.instructorId, "receivedReviews", reviewId);
    const revSnap = await tx.get(revRef);
    if (revSnap.exists()) throw new Error("You already reviewed this session.");

    const instRef = doc(db, "instructors", args.instructorId);
    const instSnap = await tx.get(instRef);
    if (!instSnap.exists()) throw new Error("Instructor not found.");

    const row = instSnap.data() as InstructorFirestoreDoc;
    const prevCount = Math.floor(Number(row.reviewCount ?? 0));
    const prevRating = Number(row.rating ?? 0);
    const n = prevCount + 1;
    const newRating = prevCount === 0 ? s : (prevRating * prevCount + s) / n;
    const ratingOut = Math.round(newRating * 10) / 10;

    tx.set(revRef, {
      learnerId: args.learnerId,
      stars: s,
      reviewText: text,
      engagementId: engagementKey,
      sessionIndex: sessionIdx,
      createdAt: serverTimestamp(),
    });
    tx.update(instRef, {
      rating: ratingOut,
      reviewCount: n,
    });
  });
}

export async function getInstructorDoc(uid: string): Promise<InstructorFirestoreDoc | null> {
  const snap = await getDoc(doc(getFirestoreDb(), "instructors", uid));
  if (!snap.exists()) return null;
  return snap.data() as InstructorFirestoreDoc;
}

export function subscribeInstructorDoc(
  uid: string | null,
  onDoc: (data: InstructorFirestoreDoc | null) => void,
): () => void {
  if (!uid) {
    onDoc(null);
    return () => {};
  }
  const db = getFirestoreDb();
  return onSnapshot(
    doc(db, "instructors", uid),
    (snap) => {
      if (!snap.exists()) onDoc(null);
      else onDoc(snap.data() as InstructorFirestoreDoc);
    },
    () => onDoc(null),
  );
}

/** Most recent learner star rating for dashboard display. */
export function subscribeLatestReceivedReviewStars(
  instructorId: string | null,
  onStars: (stars: number | null) => void,
): () => void {
  if (!instructorId) {
    onStars(null);
    return () => {};
  }
  const db = getFirestoreDb();
  const qy = query(
    collection(db, "instructors", instructorId, "receivedReviews"),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  return onSnapshot(
    qy,
    (snap) => {
      const row = snap.docs[0]?.data() as InstructorReceivedReviewDoc | undefined;
      if (!row || typeof row.stars !== "number") {
        onStars(null);
        return;
      }
      const s = Math.round(row.stars);
      onStars(Math.min(5, Math.max(1, s)));
    },
    () => onStars(null),
  );
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
    groupHourlyRate: number;
    sessionType: "solo" | "group" | "both";
    weeklyAvailability: WeeklyTimeSlot[];
    groupWeeklyAvailability: WeeklyTimeSlot[];
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
    groupHourlyRate: payload.groupHourlyRate,
    sessionType: payload.sessionType,
    weeklyAvailability: payload.weeklyAvailability,
    groupWeeklyAvailability: payload.groupWeeklyAvailability,
    maxTutoringWeeks: payload.maxTutoringWeeks,
    rating: 0,
    reviewCount: 0,
  });

  await updateDoc(doc(db, "users", uid), {
    fullName: payload.fullName,
    avatarUrl: payload.avatarUrl,
  });
}

export async function updateInstructorProfileBasics(
  uid: string,
  payload: { hourlyRate: number; nationality: string; experienceYears: number },
): Promise<void> {
  const rate = Number.isFinite(payload.hourlyRate)
    ? Math.max(0, Math.floor(payload.hourlyRate))
    : 0;
  const years = Number.isFinite(payload.experienceYears)
    ? Math.min(80, Math.max(0, Math.floor(payload.experienceYears)))
    : 0;
  await updateDoc(doc(getFirestoreDb(), "instructors", uid), {
    hourlyRate: rate,
    nationality: payload.nationality.trim(),
    experienceYears: years,
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

export async function saveLearnerOnboarding(
  uid: string,
  payload: {
    fullName: string;
    avatarUrl: string;
    skillLevel: "beginner" | "intermediate" | "advanced";
    instruments: string[];
  },
): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, "users", uid), {
    fullName: payload.fullName,
    avatarUrl: payload.avatarUrl,
    skillLevel: payload.skillLevel,
    instruments: payload.instruments,
    onboardingComplete: true,
  });
}

export async function uploadLearnerAvatar(uid: string, file: File): Promise<string> {
  const storage = getFirebaseStorage();
  const objectRef = ref(storage, `avatars/${uid}/profile`);
  await uploadBytes(objectRef, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(objectRef);
}

export function learnerOnboardingComplete(user: UserFirestoreDoc | null): boolean {
  return Boolean((user as any)?.onboardingComplete);
}

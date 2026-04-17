import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage, getFirestoreDb } from "@/lib/firebase";

/** PRD: /users/{userId} */
export type UserRole = "learner" | "instructor";

export type UserFirestoreDoc = {
  role: UserRole;
  fullName: string;
  email: string;
  avatarUrl: string;
  createdAt?: unknown;
};

/** PRD: /instructors/{userId} */
export type InstructorFirestoreDoc = {
  fullName: string;
  avatarUrl: string;
  age: number;
  experienceYears: number;
  specialties: string[];
  bio: string;
  hourlyRate: number;
  rating: number;
  reviewCount: number;
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
    specialties: string[];
    bio: string;
    hourlyRate: number;
  },
): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, "instructors", uid), {
    fullName: payload.fullName,
    avatarUrl: payload.avatarUrl,
    age: payload.age,
    experienceYears: payload.experienceYears,
    specialties: payload.specialties,
    bio: payload.bio,
    hourlyRate: payload.hourlyRate,
    rating: 0,
    reviewCount: 0,
  });

  await updateDoc(doc(db, "users", uid), {
    fullName: payload.fullName,
    avatarUrl: payload.avatarUrl,
  });
}

import type { FirebaseError } from "firebase/app";

export function formatAuthError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as FirebaseError).code) : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Try logging in.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      if (err instanceof Error && err.message) return err.message;
      return "Something went wrong. Please try again.";
  }
}

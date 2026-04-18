import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { getUserDoc, type UserFirestoreDoc } from "@/lib/tuneacademyFirestore";

type AuthState = {
  user: User | null;
  userDoc: UserFirestoreDoc | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
  refreshUserDoc: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserFirestoreDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserDoc = useCallback(async () => {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u) {
      setUserDoc(null);
      return;
    }
    setUserDoc(await getUserDoc(u.uid));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        if (firebaseUser) {
          setUserDoc(await getUserDoc(firebaseUser.uid));
        } else {
          setUserDoc(null);
        }
      } catch {
        setUserDoc(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setUserDoc(null);
  }, []);

  const value = useMemo(
    () => ({ user, userDoc, loading, signOutUser, refreshUserDoc }),
    [user, userDoc, loading, signOutUser, refreshUserDoc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  /** False when NEXT_PUBLIC_FIREBASE_* isn't set — lets ProtectedRoute avoid
   * redirect-looping to a sign-in page that can't work yet either. */
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // With no Firebase config there is no auth state to wait for, so this starts
  // resolved instead of being cleared from the effect below. `auth` is a
  // module-level singleton, so it cannot change between renders.
  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  function requireAuth() {
    if (!auth) {
      throw new Error("Firebase isn't configured — set NEXT_PUBLIC_FIREBASE_* in .env.local.");
    }
    return auth;
  }

  const value: AuthContextValue = {
    user,
    loading,
    isConfigured: Boolean(auth),
    signInWithEmail: async (email, password) => {
      await signInWithEmailAndPassword(requireAuth(), email, password);
    },
    signUpWithEmail: async (email, password) => {
      await createUserWithEmailAndPassword(requireAuth(), email, password);
    },
    signInWithGoogle: async () => {
      await signInWithPopup(requireAuth(), googleProvider);
    },
    sendResetEmail: async (email) => {
      await sendPasswordResetEmail(requireAuth(), email);
    },
    signOut: async () => {
      await firebaseSignOut(requireAuth());
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

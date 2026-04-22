"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthToken, setAuthToken } from "@/lib/authToken";
import type { AdminUser } from "@/lib/staffPermissions";

type User = AdminUser;

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const t = getAuthToken();
    setTokenState(t);
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<User>("/api/users/me", { method: "GET" });
      setUser({
        id: me.id,
        email: me.email ?? null,
        fullName: me.fullName ?? null,
        role: me.role ?? "customer",
        loyaltyPoints: me.loyaltyPoints ?? 0,
        staffPermissions: me.staffPermissions,
        staffActive: me.staffActive,
      });
    } catch {
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      refresh,
      signIn: async (t) => {
        setAuthToken(t);
        setTokenState(t);
        setLoading(true);
        await refresh();
      },
      signOut: () => {
        setAuthToken(null);
        setTokenState(null);
        setUser(null);
      },
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}


"use client";

import { Session, User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { canAccessPath, defaultPathForRoles } from "@/lib/routes";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: string[];
  loading: boolean;
  canAccess: (pathname: string) => boolean;
  hasRole: (role: string) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const publicRoutes = ["/login"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessReady, setAccessReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  function resetUserAccess() {
    setProfile(null);
    setRoles([]);
  }

  async function loadUserAccess(userId: string) {
    try {
      const [profileResponse, userRolesResponse, rolesResponse] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role_id").eq("user_id", userId),
        supabase.from("roles").select("id, code")
      ]);

      setProfile((profileResponse.data as Profile | null) ?? null);

      const roleCodeById = new Map((rolesResponse.data ?? []).map((role) => [role.id, role.code]));
      const nextRoles = (userRolesResponse.data ?? [])
        .map((userRole) => roleCodeById.get(userRole.role_id))
        .filter(Boolean) as string[];

      setRoles(nextRoles);
    } catch (_error) {
      resetUserAccess();
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrapSession() {
      setAccessReady(false);
      try {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);

        if (currentSession?.user?.id) {
          await loadUserAccess(currentSession.user.id);
        } else {
          resetUserAccess();
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setAccessReady(true);
        }
      }
    }

    bootstrapSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      setAccessReady(false);

      // Avoid awaiting extra Supabase calls inside the auth callback to prevent
      // production hangs during session changes.
      queueMicrotask(() => {
        void (async () => {
          try {
            if (nextSession?.user?.id) {
              await loadUserAccess(nextSession.user.id);
            } else {
              resetUserAccess();
            }
          } finally {
            setAccessReady(true);
          }
        })();
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading || !accessReady) return;

    const isPublic = publicRoutes.includes(pathname);
    const defaultPath = defaultPathForRoles(roles);

    if (!session && !isPublic) {
      router.replace("/login");
    }

    if (session && pathname === "/login") {
      router.replace(defaultPath);
    }

    if (session && !publicRoutes.includes(pathname) && !canAccessPath(pathname, roles)) {
      router.replace(defaultPath);
    }
  }, [accessReady, loading, pathname, router, roles, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      loading: loading || !accessReady,
      canAccess: (targetPath: string) => canAccessPath(targetPath, roles),
      hasRole: (role: string) => roles.includes(role),
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        resetUserAccess();
        setLoading(false);
        setAccessReady(true);
        router.replace("/login");
      }
    }),
    [accessReady, loading, profile, roles, router, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }

  return context;
}

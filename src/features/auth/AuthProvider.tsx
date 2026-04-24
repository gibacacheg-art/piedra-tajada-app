"use client";

import { Session, User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { canAccessPath } from "@/lib/routes";
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
  const router = useRouter();
  const pathname = usePathname();

  async function loadUserAccess(userId: string) {
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
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user?.id) {
        await loadUserAccess(data.session.user.id);
      } else {
        setProfile(null);
        setRoles([]);
      }
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) {
        await loadUserAccess(nextSession.user.id);
      } else {
        setProfile(null);
        setRoles([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const isPublic = publicRoutes.includes(pathname);

    if (!session && !isPublic) {
      router.replace("/login");
    }

    if (session && pathname === "/login") {
      router.replace("/dashboard");
    }

    if (session && !publicRoutes.includes(pathname) && !canAccessPath(pathname, roles)) {
      router.replace("/dashboard");
    }
  }, [loading, pathname, router, roles, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      loading,
      canAccess: (targetPath: string) => canAccessPath(targetPath, roles),
      hasRole: (role: string) => roles.includes(role),
      signOut: async () => {
        await supabase.auth.signOut();
        router.replace("/login");
      }
    }),
    [loading, profile, roles, router, session]
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

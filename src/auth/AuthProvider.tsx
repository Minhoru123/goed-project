import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { AuthSession, AuthUser } from '../lib/supabase';
import { isSupabaseEnabled, supabase } from '../lib/supabase';

type AuthContextValue = {
  enabled: boolean;
  loading: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
  isStaff: boolean;
  signInWithMagicLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function checkIsStaff(email: string | null | undefined): Promise<boolean> {
  if (!email || !supabase) return false;
  const { data, error } = await supabase
    .from('staff_users')
    .select('email')
    .ilike('email', email)
    .maybeSingle();
  if (error) {
    console.error('Failed to load staff status', error);
    return false;
  }
  return !!data;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(isSupabaseEnabled);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error('Failed to load Supabase session', error);
          setSession(null);
        } else {
          setSession(data.session);
        }
        setLoading(false);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error('Failed to load Supabase session', error);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const email = session?.user?.email ?? null;
    if (!email) {
      setIsStaff(false);
      return;
    }
    checkIsStaff(email).then((result) => {
      if (!cancelled) setIsStaff(result);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email]);

  const value = useMemo<AuthContextValue>(
    () => ({
      enabled: isSupabaseEnabled,
      loading,
      session,
      user: session?.user ?? null,
      isStaff,
      async signInWithMagicLink(email: string) {
        if (!supabase) {
          return 'Supabase is not configured.';
        }
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.href,
          },
        });
        return error?.message ?? null;
      },
      async signOut() {
        if (!supabase) return 'Supabase is not configured.';
        const { error } = await supabase.auth.signOut();
        return error?.message ?? null;
      },
    }),
    [loading, session, isStaff]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

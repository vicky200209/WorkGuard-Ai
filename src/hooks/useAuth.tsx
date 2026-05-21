import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<Profile | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.error('Error fetching profile:', profileErr.message);
        return null;
      }

      if (data) {
        return data as Profile;
      } else {
        // Fallback or placeholder profile if it is currently not found on DB
        return null;
      }
    } catch (err) {
      console.error('Profile fetch failed:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const prof = await fetchProfile(user.id);
      if (prof) {
        setProfile(prof);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout
    const loadingTimeout = setTimeout(() => { if (mounted) setLoading(false); }, 3000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
        fetchProfile(initialSession.user.id).then((prof) => {
          if (!mounted) return;
          if (prof) {
            setProfile(prof);
          } else {
            // No profile in table yet, set a mock/provisional profile so they aren't stuck, or keep it null
            setProfile({
              id: initialSession.user.id,
              email: initialSession.user.email || '',
              full_name: initialSession.user.user_metadata?.full_name || 'New Worker',
              role: (initialSession.user.user_metadata?.role as any) || 'worker'
            });
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          setLoading(true);
          const prof = await fetchProfile(currentSession.user.id);
          if (mounted) {
            if (prof) {
              setProfile(prof);
            } else {
              setProfile({
                id: currentSession.user.id,
                email: currentSession.user.email || '',
                full_name: currentSession.user.user_metadata?.full_name || 'New Worker',
                role: (currentSession.user.user_metadata?.role as any) || 'worker'
              });
            }
            setLoading(false);
          }
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<Profile | null> => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginErr) {
        setError(loginErr.message);
        setLoading(false);
        throw new Error(loginErr.message);
      }

      if (data?.user) {
        const prof = await fetchProfile(data.user.id);
        const resolvedProfile: Profile = prof || {
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name || 'New Worker',
          role: (data.user.user_metadata?.role as any) || 'worker'
        };
        setProfile(resolvedProfile);
        setLoading(false);
        return resolvedProfile;
      }
      setLoading(false);
      return null;
    } catch (err: any) {
      setError(err?.message || 'Login attempt failed.');
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setProfile(null);
      setUser(null);
      setSession(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, error, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  disableCurrentRemotePushToken,
  resetPushRegistrationCache,
} from './pushRegistration';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserRole = async (userId: string) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile role:', error.message);
      return null;
    }

    return typeof profile?.role === 'string' ? profile.role : null;
  };

  const applySession = async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const nextRole = await loadUserRole(nextSession.user.id);
    setRole(nextRole);
    setLoading(false);
    void updateLastAppAccess(nextSession.user.id);
  };

  const updateLastAppAccess = async (userId: string) => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('data')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error loading profile for app access update:', profileError.message);
      return;
    }

    const nextData = {
      ...(profile?.data || {}),
      last_app_access_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ data: nextData, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating app access timestamp:', updateError.message);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      void applySession(session);
      if (event === 'SIGNED_OUT') {
        resetPushRegistrationCache();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await disableCurrentRemotePushToken();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

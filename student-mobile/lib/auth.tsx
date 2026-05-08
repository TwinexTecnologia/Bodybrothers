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
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        void updateLastAppAccess(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === 'SIGNED_IN' && session?.user) {
        void updateLastAppAccess(session.user.id);
      }
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
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

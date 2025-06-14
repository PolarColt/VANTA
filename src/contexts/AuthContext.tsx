// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (
    email: string,
    password: string,
    userData: { fullName: string; role: 'student' | 'staff'; department?: string; phone?: string }
  ) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error.message);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Unexpected profile fetch error:', err);
      setProfile(null);
    }
  };

  const initSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Session error:', error.message);
      setError(error.message);
    }

    const currentSession = data.session;
    setSession(currentSession);
    setUser(currentSession?.user || null);

    if (currentSession?.user) {
      await fetchProfile(currentSession.user.id);
    }

    setLoading(false);
  };

  useEffect(() => {
    initSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user || null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      listener.subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    userData: { fullName: string; role: 'student' | 'staff'; department?: string; phone?: string }
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error || !data.user) return { error };

    const { error: profileError } = await supabase.from('user_profiles').insert([
      {
        user_id: data.user.id,
        full_name: userData.fullName,
        role: userData.role,
        email,
        department: userData.department,
        phone: userData.phone,
      },
    ]);

    if (profileError) {
      console.error('Failed to insert profile:', profileError.message);
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign-out error:', error.message);
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    error,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

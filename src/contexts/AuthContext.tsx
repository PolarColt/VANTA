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
  isDemo: boolean;
  retryConnection: () => void;
  signUp: (email: string, password: string, userData: { fullName: string; role: 'student' | 'staff'; department?: string; phone?: string }) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  demoLogin: (role: 'student' | 'staff') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Demo profile data
const createDemoProfile = (role: 'student' | 'staff'): UserProfile => ({
  id: 'demo-id',
  user_id: 'demo-user-id',
  role,
  full_name: role === 'student' ? 'Demo Student' : 'Demo Staff',
  email: `demo-${role}@example.com`,
  phone: '+1 (555) 123-4567',
  department: role === 'student' ? 'Computer Science' : 'Academic Affairs',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const initializeAuth = async (attempt = 1) => {
    try {
      setError(null);
      
      // Check if Supabase is properly configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error('Supabase configuration missing');
      }

      // Create a timeout promise that rejects after 10 seconds
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );

      // Try to get session with timeout
      const sessionPromise = supabase.auth.getSession();
      
      const { data: { session }, error: sessionError } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]);

      if (sessionError) throw sessionError;

      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      
      setLoading(false);
      setRetryCount(0);
      
    } catch (err: any) {
      console.error(`Auth initialization error (attempt ${attempt}):`, err);
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms... (${attempt}/${maxRetries})`);
        await sleep(retryDelay);
        setRetryCount(attempt);
        return initializeAuth(attempt + 1);
      }
      
      // After all retries failed, enter demo mode
      console.warn('Entering demo mode due to connection issues');
      setError('Connection failed. Running in demo mode.');
      setIsDemo(true);
      setLoading(false);
    }
  };

  const retryConnection = () => {
    setLoading(true);
    setError(null);
    setIsDemo(false);
    setRetryCount(0);
    initializeAuth();
  };

  useEffect(() => {
    let mounted = true;
    let authSubscription: any;

    const setupAuth = async () => {
      await initializeAuth();
      
      if (mounted && !isDemo) {
        // Listen for auth changes only if not in demo mode
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (mounted) {
            setSession(session);
            setUser(session?.user ?? null);
            setError(null);
            
            if (session?.user) {
              await fetchProfile(session.user.id);
            } else {
              setProfile(null);
            }
          }
        });
        
        authSubscription = subscription;
      }
    };

    setupAuth();

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Don't set error here as it might be a temporary issue
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    userData: { fullName: string; role: 'student' | 'staff'; department?: string; phone?: string }
  ) => {
    try {
      setError(null);
      
      if (isDemo) {
        return { error: { message: 'Demo mode - Sign up not available. Please configure Supabase to enable registration.' } as AuthError };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) return { error };

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: data.user.id,
            email,
            full_name: userData.fullName,
            role: userData.role,
            department: userData.department,
            phone: userData.phone,
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }
      }

      return { error: null };
    } catch (error: any) {
      console.error('SignUp error:', error);
      
      // Handle network-related errors specifically
      if (error.message?.includes('Network issue') || 
          error.message?.includes('timeout') || 
          error.message?.includes('fetch')) {
        return { 
          error: { 
            message: 'Network connection issue. Please check your internet connection and try again.' 
          } as AuthError 
        };
      }
      
      return { error: error as AuthError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      
      if (isDemo) {
        return { error: { message: 'Demo mode - Sign in not available. Use demo login buttons instead.' } as AuthError };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error: any) {
      console.error('SignIn error:', error);
      
      // Handle network-related errors
      if (error.message?.includes('Network issue') || 
          error.message?.includes('timeout') || 
          error.message?.includes('fetch')) {
        return { 
          error: { 
            message: 'Network connection issue. Please check your internet connection and try again.' 
          } as AuthError 
        };
      }
      
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      
      if (isDemo) {
        setIsDemo(false);
        setProfile(null);
        return;
      }

      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!user || isDemo) throw new Error('No user logged in or in demo mode');

      const { error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh profile
      await fetchProfile(user.id);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Demo mode login
  const demoLogin = (role: 'student' | 'staff') => {
    setIsDemo(true);
    setProfile(createDemoProfile(role));
    setError(null);
    setLoading(false);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    error,
    isDemo,
    retryConnection,
    signUp,
    signIn,
    signOut,
    updateProfile,
    demoLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
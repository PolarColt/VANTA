import { createClient } from '@supabase/supabase-js';

// Hardcoded values for WebContainer environments like Bolt
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'your-anon-key';

// Fallback to environment variables if available
const finalSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || supabaseUrl;
const finalSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || supabaseAnonKey;

// Create a fallback client for development
let supabase: any;

// Check if we have valid Supabase configuration
const hasValidConfig = finalSupabaseUrl && 
  finalSupabaseAnonKey && 
  finalSupabaseUrl !== 'your-project.supabase.co' && 
  finalSupabaseAnonKey !== 'your-anon-key';

if (!hasValidConfig) {
  console.warn('Supabase configuration missing or using placeholder values. Using demo mode.');
  
  // Create a mock client for demo purposes
  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signUp: () => Promise.resolve({ 
        data: { user: null }, 
        error: { message: 'Demo mode - Supabase not configured. Please set up your Supabase project.' } 
      }),
      signInWithPassword: () => Promise.resolve({ 
        error: { message: 'Demo mode - Supabase not configured. Please set up your Supabase project.' } 
      }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({
      select: () => ({ 
        eq: () => ({ 
          single: () => Promise.resolve({ data: null, error: { message: 'Demo mode - Database not available' } }),
          order: () => Promise.resolve({ data: [], error: { message: 'Demo mode - Database not available' } })
        }),
        order: () => Promise.resolve({ data: [], error: { message: 'Demo mode - Database not available' } }),
        gte: () => ({ 
          lte: () => Promise.resolve({ data: [], error: { message: 'Demo mode - Database not available' } })
        }),
        in: () => Promise.resolve({ data: [], error: { message: 'Demo mode - Database not available' } })
      }),
      insert: () => Promise.resolve({ error: { message: 'Demo mode - Database not available' } }),
      update: () => ({ eq: () => Promise.resolve({ error: { message: 'Demo mode - Database not available' } }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: { message: 'Demo mode - Database not available' } }) })
    })
  };
} else {
  try {
    supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey);
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    // Fallback to mock client
    supabase = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: { message: 'Failed to initialize Supabase client' } }),
        signUp: () => Promise.resolve({ data: { user: null }, error: { message: 'Network error - Unable to connect to authentication service' } }),
        signInWithPassword: () => Promise.resolve({ error: { message: 'Network error - Unable to connect to authentication service' } }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Network error' } }) }) }),
        insert: () => Promise.resolve({ error: { message: 'Network error' } }),
        update: () => ({ eq: () => Promise.resolve({ error: { message: 'Network error' } }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: { message: 'Network error' } }) })
      })
    };
  }
}

// Enhanced auth methods with network error handling
const enhancedSupabase = {
  ...supabase,
  auth: {
    ...supabase.auth,
    signUp: async (credentials: any) => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout - Please check your connection')), 10000)
        );

        const signUpPromise = supabase.auth.signUp(credentials);
        const result = await Promise.race([signUpPromise, timeoutPromise]);
        
        return result;
      } catch (error: any) {
        console.error('Signup error:', error);
        
        // Handle different types of network errors
        if (error.message?.includes('fetch') || error.message?.includes('network') || error.name === 'TypeError') {
          return {
            data: { user: null },
            error: { 
              message: 'Network issue detected. Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.' 
            }
          };
        }
        
        if (error.message?.includes('timeout')) {
          return {
            data: { user: null },
            error: { 
              message: 'Connection timeout. Please check your network and try again.' 
            }
          };
        }

        // Return the original error for other cases
        return {
          data: { user: null },
          error: { message: error.message || 'An unexpected error occurred during signup' }
        };
      }
    },
    
    signInWithPassword: async (credentials: any) => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout - Please check your connection')), 10000)
        );

        const signInPromise = supabase.auth.signInWithPassword(credentials);
        const result = await Promise.race([signInPromise, timeoutPromise]);
        
        return result;
      } catch (error: any) {
        console.error('Signin error:', error);
        
        if (error.message?.includes('fetch') || error.message?.includes('network') || error.name === 'TypeError') {
          return {
            error: { 
              message: 'Network issue detected. Please check your internet connection and try again.' 
            }
          };
        }
        
        if (error.message?.includes('timeout')) {
          return {
            error: { 
              message: 'Connection timeout. Please check your network and try again.' 
            }
          };
        }

        return {
          error: { message: error.message || 'An unexpected error occurred during signin' }
        };
      }
    },

    getSession: async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Session timeout')), 5000)
        );

        const sessionPromise = supabase.auth.getSession();
        const result = await Promise.race([sessionPromise, timeoutPromise]);
        
        return result;
      } catch (error: any) {
        console.error('Session error:', error);
        return { 
          data: { session: null }, 
          error: { message: 'Unable to retrieve session' } 
        };
      }
    }
  }
};

export { enhancedSupabase as supabase };

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          user_id: string
          role: 'student' | 'staff'
          full_name: string
          email: string
          phone?: string
          department?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'student' | 'staff'
          full_name: string
          email: string
          phone?: string
          department?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'student' | 'staff'
          full_name?: string
          email?: string
          phone?: string
          department?: string
          created_at?: string
          updated_at?: string
        }
      }
      staff_availability: {
        Row: {
          id: string
          staff_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      appointments: {
        Row: {
          id: string
          student_id: string
          staff_id: string
          appointment_date: string
          start_time: string
          end_time: string
          status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'
          subject?: string
          notes?: string
          staff_notes?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          staff_id: string
          appointment_date: string
          start_time: string
          end_time: string
          status?: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'
          subject?: string
          notes?: string
          staff_notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          staff_id?: string
          appointment_date?: string
          start_time?: string
          end_time?: string
          status?: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'
          subject?: string
          notes?: string
          staff_notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: 'appointment' | 'reminder' | 'system'
          is_read: boolean
          appointment_id?: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: 'appointment' | 'reminder' | 'system'
          is_read?: boolean
          appointment_id?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: 'appointment' | 'reminder' | 'system'
          is_read?: boolean
          appointment_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}


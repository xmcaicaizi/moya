import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { logger } from '../lib/logger';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  initialize: async () => {
    try {
      logger.info('auth', 'Initializing auth store');
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
          logger.error("auth", "Auth Init Error", error);
          set({ error: error.message, loading: false });
          return;
      }
      
      logger.info('auth', 'Initial session', data.session);
      set({ user: data.session?.user ?? null, loading: false });

      supabase.auth.onAuthStateChange((_event: string, session: any) => {
        logger.info('auth', `Auth state change: ${_event}`, session?.user);
        set({ user: session?.user ?? null });
      });
    } catch (err: any) {
      logger.error("auth", "Auth Store Initialization Failed", err);
      set({ error: err.message || 'Failed to initialize auth', loading: false });
    }
  },
  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) {
      console.error("Google sign-in error:", error);
    }
    return { error };
  },
  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },
  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  },
  signOut: async () => {
    await supabase.auth.signOut();
  }
}));

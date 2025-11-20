import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  initialize: async () => {
    try {
      // Check current session
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
          // 如果是 Proxy 返回的 error，会在这里捕获
          console.error("Auth Init Error:", error);
          set({ error: error.message, loading: false });
          return;
      }
      
      set({ user: data.session?.user ?? null, loading: false });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });
    } catch (err: any) {
      console.error("Auth Store Initialization Failed:", err);
      set({ error: err.message || 'Failed to initialize auth', loading: false });
    }
  },
  signIn: async () => {
    try {
        await supabase.auth.signInWithOAuth({ 
          provider: 'google',
          options: {
            redirectTo: window.location.origin
          }
        });
    } catch (err) {
        console.error("Sign in error:", err);
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
  }
}));

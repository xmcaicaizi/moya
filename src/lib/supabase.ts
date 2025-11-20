import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing!');
}

// 创建一个安全的 Mock 客户端，防止初始化崩溃
const createSafeClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Using Mock Supabase Client due to missing env vars");
    
    const mockError = new Error('Supabase client not initialized (Missing Env Vars)');
    const mockResponse = { data: { session: null }, error: mockError };
    
    // 模拟 Supabase 客户端结构
    return {
      auth: {
        getSession: async () => mockResponse,
        signInWithOAuth: async () => ({ error: mockError }),
        signOut: async () => ({ error: mockError }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: () => ({
        select: () => ({ order: () => ({ data: [], error: mockError }) }),
        insert: () => ({ select: () => ({ data: null, error: mockError }) }),
        update: () => ({ select: () => ({ data: null, error: mockError }) }),
        delete: () => ({ select: () => ({ data: null, error: mockError }) }),
      })
    } as any;
  }
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = createSafeClient();

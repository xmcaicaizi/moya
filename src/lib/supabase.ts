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
    
    const mockUser = {
      id: 'demo-user-id',
      email: 'demo@example.com',
      user_metadata: { full_name: 'Demo User' }
    };

    const mockSession = {
      user: mockUser,
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token'
    };

    // 模拟数据
    const mockNovels = [
      { id: '1', title: '示例小说：星际穿越', created_at: new Date().toISOString(), user_id: 'demo-user-id' },
      { id: '2', title: '示例小说：赛博侦探', created_at: new Date().toISOString(), user_id: 'demo-user-id' }
    ];
    
    const mockChapters = [
      { id: 'c1', novel_id: '1', title: '第一章：启程', content: {}, plain_text: '这是第一章的内容...', updated_at: new Date().toISOString() },
      { id: 'c2', novel_id: '1', title: '第二章：危机', content: {}, plain_text: '这是第二章的内容...', updated_at: new Date().toISOString() }
    ];

    // 模拟 Supabase 客户端结构
    return {
      auth: {
        getSession: async () => ({ data: { session: mockSession }, error: null }),
        signInWithOAuth: async () => ({ error: null }),
        signOut: async () => { window.location.reload(); return { error: null }; },
        onAuthStateChange: (callback: any) => {
          callback('SIGNED_IN', mockSession);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
      from: (table: string) => {
        const chain = {
          select: () => chain,
          order: () => chain,
          eq: (field: string, value: string) => {
             // 简单模拟查询
             if (table === 'chapters' && field === 'novel_id') {
                // @ts-ignore
                chain.data = mockChapters.filter(c => c.novel_id === value);
             }
             if (table === 'chapters' && field === 'id') {
                 // @ts-ignore
                 chain.data = mockChapters.filter(c => c.id === value);
             }
             return chain;
          },
          insert: (data: any) => {
              // @ts-ignore
              chain.data = Array.isArray(data) ? data.map(d => ({...d, id: Math.random().toString(), created_at: new Date().toISOString()})) : [{...data, id: Math.random().toString()}];
              return chain;
          },
          update: () => chain,
          delete: () => chain,
          data: table === 'novels' ? mockNovels : (table === 'chapters' ? mockChapters : [])
        };
        // @ts-ignore
        chain.then = (resolve) => resolve({ data: chain.data, error: null });
        return chain;
      },
      rpc: () => ({ data: [], error: null })
    } as any;
  }
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = createSafeClient();

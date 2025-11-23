import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 调试信息：打印环境变量读取状态
console.log('[Supabase Config Debug]', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey?.slice(0, 10),
  allEnvKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
});

// 验证 URL 是否有效 (保留基本验证逻辑)
const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return !!parsed;
  } catch {
    return false;
  }
};

// 检查配置状态
export const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl);

if (!isSupabaseConfigured) {
  console.error('❌ Supabase 配置缺失或无效！');
  console.error('请检查以下内容：');
  console.error('1. .env 文件是否在 moya/ 目录下（和 package.json 同级）');
  console.error('2. .env 文件内容格式：');
  console.error('   VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('   VITE_SUPABASE_ANON_KEY=eyJhbGci...');
  console.error('3. 修改 .env 后是否重启了 npm run dev');
}

// 直接导出客户端，如果配置缺失则允许 createClient 抛出错误或返回不可用实例
// 我们将在 App.tsx 中通过 isSupabaseConfigured 进行 UI 阻断
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

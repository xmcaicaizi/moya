import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { isZhipuConfigured } from './lib/zhipu';
import { logger } from './lib/logger';
import { Loader2, LogOut, Plus, ArrowLeft, Book, PenLine, AlertTriangle, Sun, Moon } from 'lucide-react';
import Editor from './components/Editor';
import SettingsPanel from './components/SettingsPanel';
import { useDebouncedCallback } from 'use-debounce';

interface Novel {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
}

interface Chapter {
  id: string;
  title: string;
  content: any;
  updated_at: string;
}

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('moya-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const { user, loading, error, initialize, signInWithGoogle, signInWithEmail, signUp, signOut } = useAuthStore();
  
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme());
  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const ThemeToggle = ({ className = '' }: { className?: string }) => (
    <button
      onClick={toggleTheme}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all bg-white/60 dark:bg-zinc-900/70 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:shadow ${className}`}
      aria-label="切换主题"
    >
      {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      <span>{theme === 'light' ? '夜间模式' : '日间模式'}</span>
    </button>
  );

  useEffect(() => { initialize(); }, [initialize]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.colorScheme = theme;
    window.localStorage.setItem('moya-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (user && !selectedNovel) {
      const fetchNovels = async () => {
        logger.info('novels', 'Fetching novels', { userId: user.id });
        const { data, error } = await supabase
          .from('novels')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          logger.error('novels', 'Fetch novels failed', error);
          return;
        }
        if (data) {
          logger.info('novels', 'Fetched novels', { count: data.length });
          setNovels(data as Novel[]);
        }
      };
      fetchNovels();
    }
  }, [user, selectedNovel]);

  useEffect(() => {
    if (selectedNovel) {
      const fetchChapters = async () => {
        logger.info('chapters', 'Fetching chapters', { novelId: selectedNovel.id });
        const { data, error } = await supabase
          .from('chapters')
          .select('*')
          .eq('novel_id', selectedNovel.id)
          .order('created_at', { ascending: true });
        
        if (error) {
          logger.error('chapters', 'Fetch chapters failed', error);
          return;
        }
        if (data) {
          logger.info('chapters', 'Fetched chapters', { count: data.length });
          setChapters(data as Chapter[]);
        }
      };
      fetchChapters();
    }
  }, [selectedNovel]);

  const autoSave = useDebouncedCallback(async (chapterId: string, json: any, text: string) => {
    if (!chapterId) return;
    setIsSaving(true);
    logger.info('chapters', 'Auto-saving chapter', { chapterId, textLength: text.length });
    try {
      const { error } = await supabase
        .from('chapters')
        .update({ 
          content: json, 
          plain_text: text,
          word_count: text.length,
          updated_at: new Date().toISOString() 
        })
        .eq('id', chapterId);
        
      if (error) throw error;
      logger.info('chapters', 'Auto-save success', { chapterId });
    } catch (err) {
      logger.error('chapters', 'Auto-save failed', err);
    } finally {
      setIsSaving(false);
    }
  }, 1000);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setAuthError(error.message || 'Google 登录失败，请检查 Supabase Provider 配置');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setAuthLoading(true);
    try {
      let result;
      if (isSignUp) {
        result = await signUp(email, password);
        if (result.error) throw result.error;
        alert('注册成功！请检查邮箱进行验证，或者直接登录（如果未开启验证）。');
        setIsSignUp(false); // Switch to login
      } else {
        result = await signInWithEmail(email, password);
        if (result.error) throw result.error;
      }
      setAuthError(null);
    } catch (err: any) {
      setAuthError(err.message || '认证失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const createNovel = async () => {
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    logger.info('novels', 'Creating novel', { title: newTitle });
    try {
      const { data, error } = await supabase
        .from('novels')
        .insert([{ title: newTitle, user_id: user.id }])
        .select();
      if (error) throw error;
      if (data) {
        setNovels([data[0] as Novel, ...novels]);
        logger.info('novels', 'Novel created', { id: data[0].id });
        setNewTitle('');
      }
    } catch (error) {
      logger.error('novels', 'Create novel failed', error);
      alert('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const createChapter = async () => {
    if (!selectedNovel) return;
    const title = prompt("请输入章节标题", "新章节");
    if (!title) return;
    
    logger.info('chapters', 'Creating chapter', { novelId: selectedNovel.id, title });
    try {
      const { data, error } = await supabase
        .from('chapters')
        .insert([{ 
          novel_id: selectedNovel.id, 
          title, 
          content: {},
          plain_text: ''
        }])
        .select();
        
      if (error) {
          logger.error('chapters', 'Create chapter failed', error);
          alert('章节创建失败: ' + error.message);
          return;
      }

      if (data) {
        setChapters([...chapters, data[0] as Chapter]);
        setSelectedChapter(data[0] as Chapter);
        logger.info('chapters', 'Chapter created', { id: data[0].id });
      }
    } catch (err: any) {
      logger.error('chapters', 'Unexpected error creating chapter', err);
      alert('发生意外错误: ' + err.message);
    }
  };

  // 1. Critical Configuration Check
  if (!isSupabaseConfigured) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-red-50 p-8 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg border-l-4 border-red-500">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">数据库连接未配置</h2>
          <p className="text-gray-600 mb-6">
            Moya 需要连接到 Supabase 才能存储您的数据。检测到环境变量缺失。
          </p>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-left text-sm font-mono overflow-x-auto">
            <p className="text-gray-400 mb-2">请在项目根目录创建 .env 文件：</p>
            <p>VITE_SUPABASE_URL=...</p>
            <p>VITE_SUPABASE_ANON_KEY=...</p>
          </div>
          <p className="mt-6 text-sm text-gray-500">配置完成后，请重启开发服务器。</p>
        </div>
      </div>
    );
  }

  if (error) return <div className="p-8 text-red-600 bg-red-50 h-screen flex items-center justify-center">{error}</div>;
  if (loading) return <div className="h-screen flex items-center justify-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  
  // Login Screen
  if (!user) return (
    <div className="relative h-screen flex flex-col items-center justify-center bg-paper dark:bg-zinc-950 p-6 text-ink dark:text-zinc-100 transition-colors">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-5xl font-serif font-bold text-ink dark:text-white tracking-tight">墨矢 Moya</h1>
        </div>
        
        {/* Login Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 max-w-sm mx-auto w-full">
          <button 
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-ink dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 shadow-sm mb-4"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
            <span className="font-medium text-sm">使用 Google 继续</span>
          </button>
          {authError && (
            <div className="text-left text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/40 rounded-lg p-3 mb-4">
              {authError}
              <div className="text-[11px] text-red-400 mt-1">
                如提示 provider 未启用，请前往 Supabase Dashboard → Authentication → Providers 启用 Google，并填写 GCP Client ID/Secret。
              </div>
            </div>
          )}

          <div className="relative flex py-2 items-center mb-6 text-gray-400 dark:text-gray-500">
            <div className="flex-grow border-t border-gray-200 dark:border-zinc-800"></div>
            <span className="flex-shrink-0 mx-4 text-xs">或者使用邮箱</span>
            <div className="flex-grow border-t border-gray-200 dark:border-zinc-800"></div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <input 
                type="email" 
                required
                placeholder="邮箱地址"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-ink/10 focus:border-ink transition-all text-ink dark:text-white"
              />
            </div>
            <div>
              <input 
                type="password" 
                required
                placeholder="密码 (至少6位)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-ink/10 focus:border-ink transition-all text-ink dark:text-white"
              />
            </div>
            <button 
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 px-4 bg-ink text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-md disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? '注册账号' : '登录')}
            </button>
          </form>
          
          <div className="mt-4 text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-ink dark:hover:text-white underline underline-offset-2"
            >
              {isSignUp ? '已有账号？直接登录' : '没有账号？点击注册'}
            </button>
          </div>
          
          <div className="mt-6 text-left bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700 rounded-lg p-4 text-xs space-y-2">
            <p className="font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              调试信息
            </p>
            <ul className="space-y-1 text-gray-500 dark:text-gray-400">
              <li>• Supabase 连接：{isSupabaseConfigured ? '✅ 已配置' : '❌ 缺失 VITE_SUPABASE_*'}</li>
              <li>• 智谱 AI：{isZhipuConfigured ? '✅ 可用' : '❌ 缺失 VITE_ZHIPU_API_KEY'}</li>
              <li>• Google 登录：若报错，请在 Supabase → Auth → Providers 启用 Google。</li>
              <li>• 邮箱登录：默认开启。如需跳过邮件验证，可在 Supabase Email 设置中关闭 Confirm Email。</li>
            </ul>
            <details className="mt-3 bg-white dark:bg-zinc-900 rounded p-2 border border-gray-200 dark:border-zinc-700">
              <summary className="cursor-pointer text-gray-700 dark:text-gray-300 font-semibold">🔍 环境变量检测</summary>
              <div className="mt-2 text-[10px] font-mono space-y-1 text-gray-600 dark:text-gray-400">
                <div>VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL || '❌ undefined'}</div>
                <div>VITE_SUPABASE_ANON_KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? `✅ ${import.meta.env.VITE_SUPABASE_ANON_KEY.slice(0,15)}...` : '❌ undefined'}</div>
                <div>VITE_ZHIPU_API_KEY: {import.meta.env.VITE_ZHIPU_API_KEY ? `✅ ${import.meta.env.VITE_ZHIPU_API_KEY.slice(0,10)}...` : '❌ undefined'}</div>
                <div className="pt-1 border-t border-gray-200 mt-2">
                  所有 VITE_* 变量: {Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')).join(', ') || '无'}
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );

  // Editor View
  if (selectedChapter) {
    return (
      <div className="h-screen flex flex-col bg-paper dark:bg-zinc-950 text-ink dark:text-zinc-100 transition-colors">
        <header className="bg-white/80 dark:bg-zinc-950/70 backdrop-blur-sm border-b border-gray-100 dark:border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedChapter(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 dark:text-gray-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-lg text-ink dark:text-white font-serif">{selectedChapter.title}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>}
                {isSaving ? '保存中...' : '已同步'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle className="hidden sm:flex" />
            <button 
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Book className="w-4 h-4" />
              <span className="hidden sm:inline">设定集</span>
            </button>
          </div>
        </header>
        <main className="flex-1 w-full max-w-[1440px] mx-auto p-6 sm:p-8 lg:p-12">
          <Editor 
            key={selectedChapter.id}
            novelId={selectedNovel!.id}
            chapterId={selectedChapter.id}
            initialContent={selectedChapter.content}
            isSaving={isSaving}
            onUpdate={(json, text) => autoSave(selectedChapter.id, json, text)}
          />
        </main>

        <SettingsPanel 
          novelId={selectedNovel!.id}
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
        />
      </div>
    );
  }

  // Chapter List View
  if (selectedNovel) {
    return (
      <div className="min-h-screen bg-paper dark:bg-zinc-950 text-ink dark:text-zinc-100 p-6 sm:p-12 transition-colors">
        <div className="max-w-4xl mx-auto">
          <header className="flex items-center gap-4 mb-12">
            <button onClick={() => setSelectedNovel(null)} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 dark:text-gray-300">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-serif font-bold text-ink dark:text-white">{selectedNovel.title}</h1>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">共 {chapters.length} 章</p>
            </div>
            <div className="ml-auto flex gap-2 items-center">
              <ThemeToggle className="hidden sm:flex" />
              <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-ink dark:text-white rounded-xl flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800 shadow-sm transition-all">
                <Book className="w-4 h-4" /> 
                <span className="hidden sm:inline">设定集</span>
              </button>
              <button onClick={createChapter} className="px-4 py-2 bg-ink text-white rounded-xl flex items-center gap-2 hover:opacity-90 shadow-lg shadow-gray-200/30 transition-all">
                <Plus className="w-4 h-4" /> 
                <span className="hidden sm:inline">新建章节</span>
              </button>
            </div>
          </header>
          
          <div className="grid gap-3">
            {chapters.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-2xl">
                <div className="w-16 h-16 bg-gray-50 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <PenLine className="w-8 h-8" />
                </div>
                <p className="text-gray-400 dark:text-gray-500">暂无章节，开始你的第一章吧</p>
              </div>
            )}
            {chapters.map((chapter, index) => (
              <div 
                key={chapter.id} 
                onClick={() => setSelectedChapter(chapter)}
                className="group p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl cursor-pointer hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-md transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-gray-300 dark:text-gray-500 font-serif text-lg font-bold italic w-8">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-medium text-ink dark:text-white text-lg group-hover:text-blue-600 transition-colors">{chapter.title}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      上次编辑: {new Date(chapter.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-gray-300 rotate-180 group-hover:translate-x-1 transition-transform" />
              </div>
            ))}
          </div>
        </div>
        
        <SettingsPanel 
          novelId={selectedNovel!.id}
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
        />
      </div>
    );
  }

  // Novel List View (Home)
  return (
    <div className="min-h-screen bg-paper dark:bg-zinc-950 text-ink dark:text-zinc-100 p-6 sm:p-12 transition-colors">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ink text-white rounded-lg flex items-center justify-center shadow-lg shadow-ink/30">
              <span className="font-serif font-bold text-xl">M</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-ink dark:text-white tracking-tight">墨矢</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle className="hidden sm:flex" />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-ink dark:text-white">{user.email}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Pro Plan</p>
            </div>
            <button onClick={signOut} className="p-2 text-gray-400 dark:text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-full transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="mb-12">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-4xl font-serif font-bold text-ink dark:text-white">我的作品</h2>
            <ThemeToggle className="sm:hidden" />
          </div>
          <div className="flex gap-3 max-w-xl">
            <input 
              type="text" 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="给新书起个名字..." 
              className="flex-1 p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition-all shadow-sm dark:shadow-none text-ink dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && createNovel()}
            />
            <button 
              onClick={createNovel} 
              disabled={!newTitle.trim() || creating}
              className="px-8 bg-ink text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 shadow-lg shadow-ink/30 transition-all"
            >
              {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : '新建'}
            </button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {novels.map((novel, index) => (
            <div 
              key={novel.id} 
              onClick={() => setSelectedNovel(novel)}
              className="group relative bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-xl transition-all cursor-pointer h-72 flex flex-col"
            >
              {/* 封面占位 */}
              <div className={`h-32 w-full bg-gradient-to-br ${getGradient(index)} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
              
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-xl font-serif font-bold text-ink dark:text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                  {novel.title}
                </h3>
                <div className="mt-auto flex items-center text-xs text-gray-400 dark:text-gray-500">
                  <span className="bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded text-gray-500 dark:text-gray-300">连载中</span>
                  <span className="ml-auto">{new Date(novel.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 辅助函数：生成随机渐变色封面
function getGradient(index: number) {
  const gradients = [
    'from-pink-300 to-rose-300',
    'from-orange-300 to-amber-300',
    'from-emerald-300 to-teal-300',
    'from-cyan-300 to-blue-300',
    'from-indigo-300 to-violet-300',
    'from-fuchsia-300 to-purple-300',
  ];
  return gradients[index % gradients.length];
}

export default App;

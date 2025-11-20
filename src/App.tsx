import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';
import { Loader2, BookOpen, LogOut, Plus, Save, AlertTriangle } from 'lucide-react';

interface Novel {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
}

function App() {
  const { user, loading, error, initialize, signIn, signOut } = useAuthStore();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { initialize(); }, [initialize]);

  // Load novels
  useEffect(() => {
    if (user) {
      const fetchNovels = async () => {
        const { data } = await supabase
          .from('novels')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (data) setNovels(data as Novel[]);
      };
      fetchNovels();
    }
  }, [user]);

  // Create novel
  const createNovel = async () => {
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('novels')
        .insert([{ title: newTitle, user_id: user.id }])
        .select();
      
      if (error) throw error;

      if (data) {
        setNovels([data[0] as Novel, ...novels]);
        setNewTitle('');
      }
    } catch (error) {
      console.error('Error creating novel:', error);
      alert('Failed to create novel. Please check your connection.');
    } finally {
      setCreating(false);
    }
  };
  
  // 如果有全局错误（比如 Env 缺失），优先显示
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-red-50 p-4">
        <div className="text-center space-y-4 max-w-lg">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
            <h1 className="text-2xl font-bold text-red-700">应用启动失败</h1>
            <div className="bg-white p-4 rounded-lg border border-red-200 text-left">
                <p className="text-red-600 font-mono text-sm break-all">{error}</p>
            </div>
            <p className="text-gray-600">请检查 .env 文件配置是否正确。</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
          <p className="text-gray-500">墨矢启动中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="flex justify-center">
            <BookOpen className="w-16 h-16 text-gray-900" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">墨矢 Moya</h1>
            <p className="text-gray-500 text-lg">你写一句，我记一辈子</p>
          </div>
          <button 
            onClick={signIn}
            className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
            使用 Google 账号登录
          </button>
          <p className="text-xs text-gray-400 mt-8">
            Day 1: 基础架构与数据同步
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 sm:p-8">
        <header className="flex justify-between items-center mb-12 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-gray-900" />
            <h1 className="text-xl font-bold tracking-tight">我的作品</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
              <p className="text-xs text-gray-500">免费版计划</p>
            </div>
            <button 
              onClick={signOut} 
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex gap-3 mb-8">
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="输入新书名..." 
              className="w-full p-4 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent shadow-sm transition-all"
              onKeyDown={(e) => e.key === 'Enter' && createNovel()}
            />
            <BookOpen className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 transform -translate-y-1/2" />
          </div>
          <button 
            onClick={createNovel}
            disabled={creating || !newTitle.trim()}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-md hover:shadow-lg"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            新建
          </button>
        </div>

        {novels.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">还没有作品</h3>
            <p className="text-gray-500 mt-1">创建一个新项目，开始你的创作之旅</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {novels.map((novel) => (
              <div 
                key={novel.id} 
                className="group p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-xl hover:border-gray-200 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 relative z-10 line-clamp-2">{novel.title}</h3>
                <div className="flex items-center text-gray-400 text-sm relative z-10">
                  <Save className="w-4 h-4 mr-2" />
                  <span>{new Date(novel.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

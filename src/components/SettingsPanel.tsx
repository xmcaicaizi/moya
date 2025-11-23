import { useState, useEffect } from 'react';
import { X, Plus, Trash2, User, Map, Box, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import EmbeddingService from '../lib/embedding';
import { logger } from '../lib/logger';

interface SettingsPanelProps {
  novelId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SettingItem {
  id: string;
  content: string;
  metadata: {
    type: 'character' | 'world' | 'item';
    name: string;
  };
}

const SettingsPanel = ({ novelId, isOpen, onClose }: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<'character' | 'world' | 'item'>('character');
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen && novelId) {
      fetchSettings();
    }
  }, [isOpen, novelId, activeTab]);

  const fetchSettings = async () => {
    setLoading(true);
    logger.info('settings', 'Fetching settings', { novelId, type: activeTab });
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('novel_id', novelId)
      .contains('metadata', { type: activeTab });
    
    if (error) {
      logger.error('settings', 'Fetch settings failed', error);
    }
    if (data) {
      logger.info('settings', 'Fetched settings', { count: data.length });
      setItems(data.map((d: any) => ({
        id: d.id,
        content: d.content,
        metadata: d.metadata
      })));
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName || !newDesc) return;
    setIsCreating(true);

    try {
      logger.info('settings', 'Creating setting', { type: activeTab, name: newName });
      const fullText = `【${activeTab === 'character' ? '角色' : activeTab === 'world' ? '世界观' : '物品'}】${newName}：${newDesc}`;
      const vector = await EmbeddingService.getEmbedding(fullText);

      const { error } = await supabase.from('documents').insert({
        novel_id: novelId,
        content: fullText,
        embedding: vector,
        metadata: {
          type: activeTab,
          name: newName
        }
      });

      if (error) throw error;

      setNewName('');
      setNewDesc('');
      logger.info('settings', 'Setting created');
      fetchSettings();
    } catch (err) {
      logger.error('settings', 'Create setting failed', err);
      alert('创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此设定吗？')) return;
    logger.warn('settings', 'Deleting setting', { id });
    await supabase.from('documents').delete().eq('id', id);
    fetchSettings();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center bg-paper">
          <h2 className="font-serif font-bold text-xl flex items-center gap-2 text-ink">
            <Sparkles className="w-5 h-5 text-violet-500" />
            世界设定集
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-1 border-b bg-gray-50/50">
          {[
            { id: 'character', icon: User, label: '角色' },
            { id: 'world', icon: Map, label: '世界' },
            { id: 'item', icon: Box, label: '物品' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all
                ${activeTab === tab.id 
                  ? 'bg-white text-ink shadow-sm ring-1 ring-black/5' 
                  : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-paper/50">
          {loading ? (
            <div className="flex justify-center py-10 text-gray-400"><Loader2 className="animate-spin w-6 h-6" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm">暂无{activeTab === 'character' ? '角色' : activeTab === 'world' ? '世界观' : '物品'}设定</p>
              <p className="text-gray-300 text-xs mt-1">下方添加你的第一个创意</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="group relative bg-white p-4 border border-gray-100 rounded-xl hover:border-gray-300 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-ink mb-1">{item.metadata.name}</h3>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{item.content.split('：')[1]}</p>
              </div>
            ))
          )}
        </div>

        {/* Create Form */}
        <div className="p-5 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">新增设定</h4>
          <div className="space-y-3">
            <input 
              placeholder="名称 (如: 萧炎)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-ink/5 focus:border-ink transition-all"
            />
            <textarea 
              placeholder="详细描述..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm h-24 resize-none focus:bg-white focus:ring-2 focus:ring-ink/5 focus:border-ink transition-all"
            />
            <button 
              onClick={handleCreate}
              disabled={isCreating || !newName}
              className="w-full py-3 bg-ink text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 transition-all"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              添加至记忆库
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;

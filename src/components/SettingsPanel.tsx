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

type SettingType = 'character' | 'world' | 'item' | 'outline';

interface SettingItem {
  id: string;
  content: string;
  metadata: {
    type: SettingType;
    name: string;
    section?: string;
  };
}

const SettingsPanel = ({ novelId, isOpen, onClose }: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<SettingType>('character');
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSection, setNewSection] = useState('');
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
    if (!newName || !newDesc) {
      alert(activeTab === 'outline' ? '标题和大纲内容都不能为空' : '名称和描述都不能为空');
      return;
    }
    if (activeTab === 'outline' && newDesc.length < 10) {
      alert('大纲描述至少需要 10 个字');
      return;
    }
    setIsCreating(true);

    try {
      logger.info('settings', 'Creating setting', { type: activeTab, name: newName });
      const prefixMap: Record<SettingType, string> = {
        character: '角色',
        world: '世界观',
        item: '物品',
        outline: newSection ? `大纲·${newSection}` : '大纲'
      };
      const fullText = `【${prefixMap[activeTab]}】${newName}：${newDesc}`;
      const vector = await EmbeddingService.getEmbedding(fullText);

      const { error } = await supabase.from('documents').insert({
        novel_id: novelId,
        content: fullText,
        embedding: vector,
        metadata: {
          type: activeTab,
          name: newName,
          section: activeTab === 'outline' ? newSection || undefined : undefined
        }
      });

      if (error) throw error;

      setNewName('');
      setNewDesc('');
      setNewSection('');
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
        className={`fixed inset-y-0 right-0 w-96 bg-surface-2 shadow-elevation z-50 flex flex-col transform transition-transform duration-300 ease-in-out border-l border-surface-3 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center bg-surface-2 border-surface-3">
          <h2 className="font-serif font-bold text-xl flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5 text-violet-500" />
            世界设定集
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-3 rounded-full transition-colors text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-1 border-b bg-surface-1 border-surface-3">
          {[
            { id: 'character', icon: User, label: '角色' },
            { id: 'world', icon: Map, label: '世界' },
            { id: 'item', icon: Box, label: '物品' },
            { id: 'outline', icon: Sparkles, label: '大纲' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all
                ${activeTab === tab.id 
                  ? 'bg-surface-2 text-primary shadow-elevation' 
                  : 'text-muted hover:bg-surface-3 hover:text-primary'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-surface-1/60">
          {loading ? (
            <div className="flex justify-center py-10 text-gray-400"><Loader2 className="animate-spin w-6 h-6" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-surface-3 rounded-xl bg-surface-2">
              <p className="text-muted text-sm">暂无{activeTab === 'character' ? '角色' : activeTab === 'world' ? '世界观' : activeTab === 'item' ? '物品' : '剧情大纲'}</p>
              <p className="text-muted text-xs mt-1">{activeTab === 'outline' ? '点击下方新增节点，梳理故事结构' : '下方添加你的第一个创意'}</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="group relative surface-card p-4 rounded-xl hover:border-surface-4 hover:shadow-elevation transition-all">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-primary mb-1">{item.metadata.name}</h3>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-muted leading-relaxed line-clamp-3">{item.content.split('：')[1]}</p>
              </div>
            ))
          )}
        </div>

        {/* Create Form */}
        <div className="p-5 border-t bg-surface-2 border-surface-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">新增设定</h4>
          <div className="space-y-3">
            <input 
              placeholder="名称 (如: 萧炎)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full p-3 bg-surface-1 border border-surface-3 rounded-xl text-sm focus:bg-surface-2 focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-all text-primary"
            />
            {activeTab === 'outline' && (
              <input 
                placeholder="章节 / 节点（如：第 3 章）"
                value={newSection}
                onChange={e => setNewSection(e.target.value)}
                className="w-full p-3 bg-surface-1 border border-surface-3 rounded-xl text-sm focus:bg-surface-2 focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-all text-primary"
              />
            )}
            <textarea 
              placeholder={activeTab === 'outline' ? '剧情概述、冲突、伏笔...' : '详细描述...'}
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full p-3 bg-surface-1 border border-surface-3 rounded-xl text-sm h-24 resize-none focus:bg-surface-2 focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-all text-primary"
            />
            <button 
              onClick={handleCreate}
              disabled={isCreating || !newName}
              className="w-full py-3 btn-primary rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 transition-all"
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

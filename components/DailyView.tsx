import React, { useState, useEffect } from 'react';
import { DailyRecord, TimeBlock, ExecutionStatus, EfficiencyRating } from '../types';
import { saveDailyRecord } from '../services/storage';
import { Clock, CheckCircle2, AlertCircle, Edit3, Flag, Save } from 'lucide-react';

interface DailyViewProps {
  record: DailyRecord;
  onUpdateRecord: (r: DailyRecord) => void;
  onOpenAct: () => void;
}

const STATUS_LABELS: Record<ExecutionStatus, string> = {
    'completed': '完成',
    'partial': '部分',
    'changed': '变更',
    'skipped': '跳过',
    'none': '未设',
};

const EFFICIENCY_LABELS: Record<string, string> = {
    'high': '高',
    'normal': '中',
    'low': '低',
    'null': '无'
};

const DailyView: React.FC<DailyViewProps> = ({ record, onUpdateRecord, onOpenAct }) => {
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | null>(null);
  
  // -- Edit Modal State --
  const [editType, setEditType] = useState<'plan' | 'do' | 'check'>('plan');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState<ExecutionStatus>('none');
  const [editEfficiency, setEditEfficiency] = useState<EfficiencyRating>(null);

  // -- Principal Task Editing --
  const [isEditingPrincipal, setIsEditingPrincipal] = useState(false);
  const [tempP1, setTempP1] = useState('');
  const [tempP2, setTempP2] = useState('');

  useEffect(() => {
    // Sync local state when record changes
    if (record) {
        setTempP1(record.primaryTasks[0]);
        setTempP2(record.primaryTasks[1]);
    }
  }, [record]);

  const savePrincipalTasks = () => {
    const updated = {
        ...record,
        primaryTasks: [tempP1, tempP2] as [string, string]
    };
    onUpdateRecord(updated);
    saveDailyRecord(updated);
    setIsEditingPrincipal(false);
  };

  const openEditor = (block: TimeBlock, type: 'plan' | 'do' | 'check') => {
    // Bio locked blocks cannot be edited in Plan
    if (type === 'plan' && block.plan.isBioLocked) return;

    setSelectedBlock(block);
    setEditType(type);
    
    if (type === 'plan') setEditContent(block.plan.content);
    if (type === 'do') {
        setEditContent(block.do.actualContent || block.plan.content);
        setEditStatus(block.do.status);
    }
    if (type === 'check') {
        setEditContent(block.check.comment);
        setEditEfficiency(block.check.efficiency);
    }
  };

  const saveBlock = () => {
    if (!selectedBlock) return;

    const newBlocks = record.timeBlocks.map(b => {
      if (b.id !== selectedBlock.id) return b;
      
      const newB = { ...b };
      if (editType === 'plan') {
        newB.plan.content = editContent;
      } else if (editType === 'do') {
        newB.do.actualContent = editContent;
        newB.do.status = editStatus;
      } else if (editType === 'check') {
        newB.check.comment = editContent;
        newB.check.efficiency = editEfficiency;
      }
      return newB;
    });

    const newRecord = { ...record, timeBlocks: newBlocks };
    onUpdateRecord(newRecord);
    saveDailyRecord(newRecord);
    setSelectedBlock(null);
  };

  // Status colors
  const getStatusColor = (status: ExecutionStatus) => {
    switch(status) {
      case 'completed': return 'bg-green-100 border-green-300 text-green-800';
      case 'partial': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'changed': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'skipped': return 'bg-red-50 border-red-200 text-red-400 decoration-line-through';
      default: return 'bg-white border-transparent';
    }
  };

  const getEfficiencyColor = (eff: EfficiencyRating) => {
     if (eff === 'high') return 'bg-green-500';
     if (eff === 'normal') return 'bg-blue-400';
     if (eff === 'low') return 'bg-red-400';
     return 'bg-slate-200';
  };

  const getEditTitle = (type: string) => {
      switch(type) {
          case 'plan': return '计划 (Plan)';
          case 'do': return '执行 (Do)';
          case 'check': return '检查 (Check)';
          default: return type;
      }
  };

  return (
    <div className="space-y-6">
      {/* Principal Tasks Banner */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Flag className="w-32 h-32" />
        </div>
        
        <div className="relative z-10 flex justify-between items-start mb-3">
             <h3 className="text-brand-100 text-sm font-semibold uppercase tracking-wider">今日主要任务 (Core Tasks)</h3>
             {!isEditingPrincipal ? (
                 <button 
                    onClick={() => setIsEditingPrincipal(true)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"
                    title="编辑主要任务"
                 >
                    <Edit3 className="w-4 h-4" />
                 </button>
             ) : (
                <button 
                    onClick={savePrincipalTasks}
                    className="p-1.5 bg-green-500/80 hover:bg-green-500 rounded-lg transition-colors text-white shadow-sm"
                    title="保存"
                 >
                    <Save className="w-4 h-4" />
                 </button>
             )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 relative z-10">
          {!isEditingPrincipal ? (
             record.primaryTasks.map((task, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-lg flex items-center gap-3 min-h-[4rem]">
                   <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">{i+1}</div>
                   <span className="font-medium text-lg truncate w-full" title={task}>{task || <span className="text-white/40 italic">未设置 (点击编辑图标)</span>}</span>
                </div>
             ))
          ) : (
             <>
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 p-2 rounded-lg flex items-center gap-3">
                   <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">1</div>
                   <input 
                      value={tempP1}
                      onChange={(e) => setTempP1(e.target.value)}
                      placeholder="任务 1..."
                      className="bg-transparent border-none outline-none text-white placeholder-white/40 w-full font-medium text-lg focus:ring-0"
                      autoFocus
                   />
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 p-2 rounded-lg flex items-center gap-3">
                   <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">2</div>
                   <input 
                      value={tempP2}
                      onChange={(e) => setTempP2(e.target.value)}
                      placeholder="任务 2..."
                      className="bg-transparent border-none outline-none text-white placeholder-white/40 w-full font-medium text-lg focus:ring-0"
                   />
                </div>
             </>
          )}
        </div>
      </div>

      {/* Tri-Track Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600 sticky top-0 z-20">
          <div className="col-span-2 md:col-span-1 p-3 text-center border-r border-slate-200">时间</div>
          <div className="col-span-4 md:col-span-5 p-3 border-r border-slate-200 pl-4">计划 (Plan)</div>
          <div className="col-span-4 md:col-span-5 p-3 border-r border-slate-200 pl-4">执行 (Do)</div>
          <div className="col-span-2 md:col-span-1 p-3 text-center">检查 (Check)</div>
        </div>

        <div className="divide-y divide-slate-100">
          {record.timeBlocks.map((block) => {
             const isLocked = block.plan.isBioLocked;
             
             return (
              <div key={block.id} className="grid grid-cols-12 hover:bg-slate-50 transition-colors group">
                {/* Time - Widened for mobile */}
                <div className="col-span-2 md:col-span-1 py-3 text-xs md:text-sm text-slate-400 text-center font-mono border-r border-slate-200 flex items-center justify-center">
                   {block.time}
                </div>

                {/* Plan */}
                <div 
                   onClick={() => openEditor(block, 'plan')}
                   className={`col-span-4 md:col-span-5 p-2 md:p-3 border-r border-slate-200 text-sm cursor-pointer relative ${isLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed italic' : 'hover:bg-blue-50/50'}`}
                >
                   {block.plan.content}
                   {isLocked && <span className="absolute right-2 top-3 text-xs text-slate-300">BIO</span>}
                </div>

                {/* Do */}
                <div 
                   onClick={() => openEditor(block, 'do')}
                   className={`col-span-4 md:col-span-5 p-2 md:p-3 border-r border-slate-200 text-sm cursor-pointer border-l-4 ${getStatusColor(block.do.status).replace('bg-', 'hover:brightness-95 ')}`}
                >
                    <div className={`h-full w-full rounded px-2 py-1 flex items-center ${getStatusColor(block.do.status)}`}>
                        {block.do.actualContent || (block.do.status === 'none' ? <span className="opacity-0 group-hover:opacity-100 text-slate-300">点击记录</span> : '')}
                    </div>
                </div>

                {/* Check */}
                <div 
                   onClick={() => openEditor(block, 'check')}
                   className="col-span-2 md:col-span-1 p-2 border-r border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-100"
                >
                    <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full ${getEfficiencyColor(block.check.efficiency)}`}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-20" /> {/* Spacer for FAB */}
      
      {/* Floating Action Button for Act */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-30">
        <button 
           onClick={onOpenAct}
           className="bg-brand-600 hover:bg-brand-700 text-white shadow-xl rounded-full px-6 py-4 flex items-center gap-2 font-bold transition-transform hover:scale-105"
        >
            <Edit3 className="w-5 h-5" />
            结束今日 (Act)
        </button>
      </div>

      {/* Editor Modal/Popover (Simplification: Centered Modal) */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]" onClick={() => setSelectedBlock(null)}>
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4 text-slate-800 capitalize">编辑 {getEditTitle(editType)} - {selectedBlock.time}</h3>
              
              <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">内容</label>
                    <input 
                      autoFocus
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-brand-500 outline-none" 
                      value={editContent} 
                      onChange={e => setEditContent(e.target.value)} 
                    />
                  </div>

                  {editType === 'do' && (
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2">执行状态</label>
                        <div className="flex flex-wrap gap-2">
                            {(['completed', 'partial', 'changed', 'skipped'] as const).map(s => (
                                <button 
                                  key={s}
                                  onClick={() => setEditStatus(s)}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border ${editStatus === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-400'}`}
                                >
                                    {STATUS_LABELS[s]}
                                </button>
                            ))}
                        </div>
                     </div>
                  )}

                  {editType === 'check' && (
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2">效率</label>
                         <div className="flex gap-4">
                            {(['high', 'normal', 'low'] as const).map(e => (
                                <div key={e} className="flex flex-col items-center gap-1">
                                    <button
                                    onClick={() => setEditEfficiency(e)}
                                    className={`w-8 h-8 rounded-full ring-2 ring-offset-2 ${editEfficiency === e ? 'ring-brand-500' : 'ring-transparent'} ${getEfficiencyColor(e)}`}
                                    />
                                    <span className="text-xs text-slate-500">{EFFICIENCY_LABELS[e]}</span>
                                </div>
                            ))}
                         </div>
                     </div>
                  )}

                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setSelectedBlock(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">取消</button>
                      <button onClick={saveBlock} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">保存</button>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DailyView;
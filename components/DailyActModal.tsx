import React, { useState, useEffect } from 'react';
import { DailyRecord, TaskItem, EfficiencyRating } from '../types';
import { getTaskPool, saveTaskPool, saveDailyRecord } from '../services/storage';
import { Plus, ArrowRight, Save, X, RotateCcw } from 'lucide-react';

interface DailyActModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DailyRecord;
  onRecordUpdate: (updated: DailyRecord) => void;
  onConfirmDayEnd: (nextDayPrimary: [string, string]) => void;
}

const DailyActModal: React.FC<DailyActModalProps> = ({ isOpen, onClose, record, onRecordUpdate, onConfirmDayEnd }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [summary, setSummary] = useState(record.daySummary);
  const [taskPool, setTaskPool] = useState<TaskItem[]>([]);
  const [nextP1, setNextP1] = useState('');
  const [nextP2, setNextP2] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Metrics State
  const [metrics, setMetrics] = useState({ completionRate: 0, efficiencyLabel: '未知' });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSummary(record.daySummary);
      calculateMetrics();
      // Fetch pool asynchronously
      getTaskPool().then(setTaskPool);
    }
  }, [isOpen, record]);

  const calculateMetrics = () => {
      // 1. Completion Rate: (Completed + Partial) / Total Planned Blocks (that are not empty or bio locked)
      let totalPlanned = 0;
      let completedPoints = 0;

      // 2. Efficiency: Average of High(3)/Normal(2)/Low(1)
      let efficiencySum = 0;
      let efficiencyCount = 0;

      record.timeBlocks.forEach(block => {
          // Skip bio locked
          if (block.plan.isBioLocked) return;
          
          if (block.plan.content) {
              totalPlanned++;
              if (block.do.status === 'completed') completedPoints += 1;
              else if (block.do.status === 'partial') completedPoints += 0.5;
              else if (block.do.status === 'changed') completedPoints += 0.8; // Flexible execution counts
          }

          if (block.check.efficiency) {
              efficiencyCount++;
              if (block.check.efficiency === 'high') efficiencySum += 3;
              else if (block.check.efficiency === 'normal') efficiencySum += 2;
              else if (block.check.efficiency === 'low') efficiencySum += 1;
          }
      });

      const rate = totalPlanned > 0 ? Math.round((completedPoints / totalPlanned) * 100) : 0;
      
      let avgEff = 0;
      let effLabel = '无数据';
      if (efficiencyCount > 0) {
          avgEff = efficiencySum / efficiencyCount;
          if (avgEff >= 2.5) effLabel = '高';
          else if (avgEff >= 1.5) effLabel = '正常';
          else effLabel = '低';
      }

      setMetrics({ completionRate: rate, efficiencyLabel: effLabel });
  };

  const handleSummarySave = async () => {
    const updated = { ...record, daySummary: summary };
    await saveDailyRecord(updated);
    onRecordUpdate(updated);
    setStep(2);
  };

  const addTaskToPool = async () => {
    if (!newTaskTitle.trim()) return;
    const newTask: TaskItem = {
      id: Date.now().toString(),
      title: newTaskTitle,
      createdDate: new Date().toISOString(),
      source: 'manual',
      status: 'pending'
    };
    const newPool = [...taskPool, newTask];
    setTaskPool(newPool);
    await saveTaskPool(newPool);
    setNewTaskTitle('');
  };

  const selectTaskForTomorrow = (title: string) => {
    if (!nextP1) setNextP1(title);
    else if (!nextP2) setNextP2(title);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
             <div className="bg-brand-100 p-2 rounded-lg">
                <RotateCcw className="w-5 h-5 text-brand-600" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-800">每日复盘与行动 (Review & Act)</h2>
                <p className="text-xs text-slate-500">完成今日闭环，准备明日计划。</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                 <h3 className="font-semibold text-blue-900 mb-2">今日检查指标 (实时计算)</h3>
                 <div className="flex gap-4 text-sm text-blue-800">
                    <div className="px-3 py-1 bg-white rounded-md shadow-sm">
                        平均效率: <span className={`font-bold ${metrics.efficiencyLabel === '高' ? 'text-green-600' : metrics.efficiencyLabel === '低' ? 'text-red-500' : 'text-blue-600'}`}>{metrics.efficiencyLabel}</span>
                    </div>
                    <div className="px-3 py-1 bg-white rounded-md shadow-sm">
                        计划完成率: <span className="font-bold">{metrics.completionRate}%</span>
                    </div>
                 </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">今日总结</label>
                <textarea 
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full h-48 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none text-slate-700"
                  placeholder="今天过得怎么样？完成了什么？有什么需要改进的？"
                />
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={handleSummarySave}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium transition-colors shadow-lg shadow-brand-200"
                >
                  下一步：计划明日 <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col md:flex-row gap-6 h-full animate-fade-in">
              {/* Left: Backlog */}
              <div className="flex-1 flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <div className="p-4 border-b border-slate-200 bg-white">
                  <h3 className="font-bold text-slate-800">任务池 (待办)</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {taskPool.filter(t => t.status !== 'done').map(task => (
                    <div key={task.id} 
                      onClick={() => selectTaskForTomorrow(task.title)}
                      className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-brand-400 hover:shadow-md cursor-pointer transition-all group flex justify-between items-center"
                    >
                      <span className="text-sm text-slate-700">{task.title}</span>
                      <Plus className="w-4 h-4 text-brand-400 opacity-0 group-hover:opacity-100" />
                    </div>
                  ))}
                  {taskPool.length === 0 && <div className="text-center text-slate-400 text-sm py-4">暂无待办任务。</div>}
                </div>
                <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
                  <input 
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="快速添加新任务..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                    onKeyDown={(e) => e.key === 'Enter' && addTaskToPool()}
                  />
                  <button onClick={addTaskToPool} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right: Tomorrow */}
              <div className="flex-1 flex flex-col border border-brand-200 rounded-xl overflow-hidden bg-brand-50/30">
                 <div className="p-4 border-b border-brand-100 bg-white">
                  <h3 className="font-bold text-brand-900">明日核心聚焦</h3>
                  <p className="text-xs text-brand-600 mt-1">选择 2 个主要任务</p>
                </div>
                <div className="p-6 space-y-6 flex-1">
                   <div>
                      <label className="block text-xs font-bold text-brand-800 uppercase tracking-wide mb-2">优先级 1 (Priority 1)</label>
                      <input 
                        value={nextP1}
                        onChange={(e) => setNextP1(e.target.value)}
                        placeholder="从左侧选择或输入..."
                        className="w-full p-4 border border-brand-200 rounded-xl shadow-sm focus:ring-2 focus:ring-brand-500 outline-none text-brand-900 font-medium"
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-brand-800 uppercase tracking-wide mb-2">优先级 2 (Priority 2)</label>
                      <input 
                        value={nextP2}
                        onChange={(e) => setNextP2(e.target.value)}
                        placeholder="从左侧选择或输入..."
                        className="w-full p-4 border border-brand-200 rounded-xl shadow-sm focus:ring-2 focus:ring-brand-500 outline-none text-brand-900 font-medium"
                      />
                   </div>
                </div>
                <div className="p-4 bg-white border-t border-brand-100">
                  <button 
                    onClick={() => onConfirmDayEnd([nextP1, nextP2])}
                    disabled={!nextP1}
                    className="w-full py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold shadow-lg shadow-brand-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> 定稿并开启新的一天
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DailyActModal;
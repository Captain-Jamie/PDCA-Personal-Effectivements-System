import React, { useState, useEffect, useMemo } from 'react';
import { DailyRecord, TimeBlock, ExecutionStatus, EfficiencyRating, BioClockConfig, DayTemplate } from '../types';
import { saveDailyRecord, exportToCSV, getBioClockConfig, saveDayTemplate, getDayTemplates } from '../services/storage';
import { Edit3, Flag, Save, Copy, ClipboardPaste, Plus, Clock, FileDown, Scissors, Trash2, Unlink, Link, LayoutTemplate, Download, Upload } from 'lucide-react';

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

const getStatusColor = (status: ExecutionStatus) => {
    switch (status) {
        case 'completed': return 'bg-blue-50 border-blue-500 text-blue-700';
        case 'partial': return 'bg-yellow-50 border-yellow-500 text-yellow-700';
        case 'changed': return 'bg-purple-50 border-purple-500 text-purple-700';
        case 'skipped': return 'bg-slate-100 border-slate-400 text-slate-500 decoration-slate-400';
        case 'none': default: return 'bg-white border-transparent text-slate-700 hover:bg-slate-50';
    }
};

const getEfficiencyColor = (eff: EfficiencyRating) => {
    switch (eff) {
        case 'high': return 'bg-green-500';
        case 'normal': return 'bg-blue-400';
        case 'low': return 'bg-orange-400';
        default: return 'bg-slate-200';
    }
};

const getEditTitle = (type: 'plan' | 'do' | 'check') => {
    switch (type) {
        case 'plan': return '计划 (Plan)';
        case 'do': return '执行 (Do)';
        case 'check': return '检查 (Check)';
    }
};

const DailyView: React.FC<DailyViewProps> = ({ record, onUpdateRecord, onOpenAct }) => {
  // -- State --
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null); // Use ID or 'NEW'
  const [clipboard, setClipboard] = useState<{ content: string, status?: ExecutionStatus, type: 'plan' | 'do' } | null>(null);
  const [bioConfig, setBioConfig] = useState<BioClockConfig | null>(null);

  // -- Edit Modal State --
  const [editType, setEditType] = useState<'plan' | 'do' | 'check'>('plan');
  const [editContent, setEditContent] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editStatus, setEditStatus] = useState<ExecutionStatus>('none');
  const [editEfficiency, setEditEfficiency] = useState<EfficiencyRating>(null);

  // -- Splitting State --
  const [splitTargetId, setSplitTargetId] = useState<string | null>(null);
  const [splitTime, setSplitTime] = useState('');

  // -- Principal Task Editing --
  const [isEditingPrincipal, setIsEditingPrincipal] = useState(false);
  const [tempP1, setTempP1] = useState('');
  const [tempP2, setTempP2] = useState('');

  // -- Template State --
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<DayTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    if (record) {
        setTempP1(record.primaryTasks[0]);
        setTempP2(record.primaryTasks[1]);
    }
  }, [record]);

  useEffect(() => {
      getBioClockConfig().then(setBioConfig);
  }, []);

  // --- Helper: Time Calculations ---
  const timeToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
  };

  const minutesToTime = (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const isTimeInSleepWindow = (time: string, config: BioClockConfig): boolean => {
      const tVal = timeToMinutes(time);
      const [start, end] = config.sleepWindow;
      const sVal = timeToMinutes(start);
      const eVal = timeToMinutes(end);
      
      if (sVal > eVal) {
          return tVal > sVal || tVal < eVal;
      } else {
          return tVal > sVal && tVal < eVal;
      }
  };

  // --- Derived State: Visible Blocks ---
  const visibleBlocks = useMemo(() => {
      if (!bioConfig || !bioConfig.enableSleepFold) return record.timeBlocks;
      return record.timeBlocks.filter(b => !isTimeInSleepWindow(b.time, bioConfig));
  }, [record.timeBlocks, bioConfig]);

  // --- Actions ---

  const handleCopy = (content: string, status: ExecutionStatus | undefined, type: 'plan' | 'do', e: React.MouseEvent) => {
      e.stopPropagation();
      setClipboard({ content, status, type });
  };

  const handlePaste = (blockId: string, targetCol: 'plan' | 'do', e: React.MouseEvent) => {
      e.stopPropagation();
      if (!clipboard) return;

      const newBlocks = record.timeBlocks.map(b => {
          if (b.id !== blockId) return b;
          
          const newB = { ...b };
          if (targetCol === 'plan') {
               newB.plan.content = clipboard.content; 
          } else {
               newB.do.actualContent = clipboard.content;
               if (clipboard.status && clipboard.type === 'do') newB.do.status = clipboard.status;
          }
          return newB;
      });
      
      const newRecord = { ...record, timeBlocks: newBlocks };
      onUpdateRecord(newRecord);
      saveDailyRecord(newRecord);
      setClipboard(null);
  };

  const handleExport = () => {
      const rows = [
          ["Date", record.date],
          ["Summary", record.daySummary],
          ["Primary Task 1", record.primaryTasks[0]],
          ["Primary Task 2", record.primaryTasks[1]],
          [],
          ["Time", "Plan", "Do", "Status", "Check Comment", "Efficiency"]
      ];

      record.timeBlocks.forEach(b => {
          rows.push([
              b.time,
              b.plan.content.replace(/\n/g, '; '),
              b.do.actualContent.replace(/\n/g, '; '),
              b.do.status,
              b.check.comment.replace(/\n/g, '; '),
              b.check.efficiency || ''
          ]);
      });

      exportToCSV(`PDCA_Daily_${record.date}.csv`, rows);
  };

  const savePrincipalTasks = () => {
    const updated = {
        ...record,
        primaryTasks: [tempP1, tempP2] as [string, string]
    };
    onUpdateRecord(updated);
    saveDailyRecord(updated);
    setIsEditingPrincipal(false);
  };

  // --- Time Manipulation ---
  
  const handleDeleteTime = (blockId: string) => {
      if (!confirm("确定要删除这个时间段吗？")) return;
      const newBlocks = record.timeBlocks.filter(b => b.id !== blockId);
      const newRecord = { ...record, timeBlocks: newBlocks };
      onUpdateRecord(newRecord);
      saveDailyRecord(newRecord);
  };

  const extractContentForTime = (fullText: string, targetTime: string): { extracted: string, remaining: string } => {
      if (!fullText) return { extracted: '', remaining: '' };
      const escapedTime = targetTime.replace(':', '\\:');
      const regex = new RegExp(`\\[${escapedTime}\\]\\s*(.*?)(?=(\\n\\[|$))`, 's');
      const match = fullText.match(regex);
      if (match) {
          const extracted = match[1].trim(); 
          const remaining = fullText.replace(match[0], '').trim(); 
          return { extracted, remaining };
      }
      return { extracted: '', remaining: fullText };
  };

  const handleSplitBlock = () => {
      if(!splitTargetId || !splitTime) return;
      
      const targetBlockIndex = record.timeBlocks.findIndex(b => b.id === splitTargetId);
      if(targetBlockIndex === -1) return;
      const targetBlock = record.timeBlocks[targetBlockIndex];

      const newTimeMin = timeToMinutes(splitTime);
      const targetMin = timeToMinutes(targetBlock.time);
      
      if(newTimeMin <= targetMin) {
          alert("拆分时间必须晚于当前时间块开始时间");
          return;
      }
      
      if (record.timeBlocks.some(b => b.time === splitTime)) {
          alert("该时间点已存在");
          return;
      }

      // Migration Logic
      let newPlanContent = '';
      let newDoContent = '';
      let updatedTargetPlan = targetBlock.plan.content;
      let updatedTargetDo = targetBlock.do.actualContent;

      const planExtract = extractContentForTime(targetBlock.plan.content, splitTime);
      if (planExtract.extracted) {
          newPlanContent = planExtract.extracted;
          updatedTargetPlan = planExtract.remaining;
      }

      const doExtract = extractContentForTime(targetBlock.do.actualContent, splitTime);
      if (doExtract.extracted) {
          newDoContent = doExtract.extracted;
          updatedTargetDo = doExtract.remaining;
      }

      const newBlock: TimeBlock = {
          id: `${record.date}-${splitTime}`,
          time: splitTime,
          plan: { ...targetBlock.plan, content: newPlanContent, startTime: splitTime, endTime: '', span: 1 },
          do: { ...targetBlock.do, actualContent: newDoContent, status: 'none', startTime: splitTime, endTime: '', span: 1 },
          check: { efficiency: null, tags: [], comment: '' }
      };

      const updatedTargetBlock = {
          ...targetBlock,
          plan: { ...targetBlock.plan, content: updatedTargetPlan },
          do: { ...targetBlock.do, actualContent: updatedTargetDo }
      };

      const newBlocks = [...record.timeBlocks];
      newBlocks[targetBlockIndex] = updatedTargetBlock;
      newBlocks.push(newBlock);
      newBlocks.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

      const newRecord = { ...record, timeBlocks: newBlocks };
      onUpdateRecord(newRecord);
      saveDailyRecord(newRecord);
      setSplitTargetId(null);
      setSplitTime('');
  };

  // --- Merging Logic (Handles) ---

  const handleMergeAction = (blockId: string, col: 'plan' | 'do', action: 'merge' | 'split') => {
      const idx = record.timeBlocks.findIndex(b => b.id === blockId);
      if (idx === -1) return;

      const currentBlock = record.timeBlocks[idx];
      const newBlocks = [...record.timeBlocks];
      const currentSpan = (col === 'plan' ? currentBlock.plan.span : currentBlock.do.span) || 1;

      if (action === 'merge') {
          // Merge with next block (increase span)
          // Pre-condition: Next block exists and is not merged into something else (span=1)
          const nextIdx = idx + currentSpan; // The block immediately after the current merged group
          if (nextIdx >= newBlocks.length) return;

          const newSpan = currentSpan + 1;
          const blockToMerge = newBlocks[nextIdx];
          
          if (col === 'plan') {
               newBlocks[idx] = { ...currentBlock, plan: { ...currentBlock.plan, span: newSpan } };
               newBlocks[nextIdx] = { ...blockToMerge, plan: { ...blockToMerge.plan, span: 0 } }; // 0 means hidden
          } else {
               newBlocks[idx] = { ...currentBlock, do: { ...currentBlock.do, span: newSpan } };
               newBlocks[nextIdx] = { ...blockToMerge, do: { ...blockToMerge.do, span: 0 } };
          }

      } else {
          // Split (Decrease span by 1 from the bottom)
          if (currentSpan <= 1) return;
          const newSpan = currentSpan - 1;
          const blockToReleaseIdx = idx + newSpan; // The last block currently covered

          if (col === 'plan') {
              newBlocks[idx] = { ...currentBlock, plan: { ...currentBlock.plan, span: newSpan } };
              const releasedBlock = newBlocks[blockToReleaseIdx];
              newBlocks[blockToReleaseIdx] = { ...releasedBlock, plan: { ...releasedBlock.plan, span: 1 } };
          } else {
              newBlocks[idx] = { ...currentBlock, do: { ...currentBlock.do, span: newSpan } };
              const releasedBlock = newBlocks[blockToReleaseIdx];
              newBlocks[blockToReleaseIdx] = { ...releasedBlock, do: { ...releasedBlock.do, span: 1 } };
          }
      }

      const newRecord = { ...record, timeBlocks: newBlocks };
      onUpdateRecord(newRecord);
      saveDailyRecord(newRecord);
  };

  // --- Template Logic ---

  const handleOpenTemplates = async () => {
      const saved = await getDayTemplates();
      setTemplates(saved);
      setShowTemplateModal(true);
  };

  const saveCurrentAsTemplate = async () => {
      if (!newTemplateName) return;
      const tpl: DayTemplate = {
          id: Date.now().toString(),
          name: newTemplateName,
          primaryTasks: record.primaryTasks,
          timeBlocks: record.timeBlocks
      };
      await saveDayTemplate(tpl);
      setTemplates(await getDayTemplates());
      setNewTemplateName('');
      alert("模板保存成功");
  };

  const loadTemplate = async (tpl: DayTemplate) => {
      if (!confirm(`确定要加载模板 "${tpl.name}" 吗？这将覆盖当前的日程安排。`)) return;
      
      // Need to adjust IDs to match current date
      const newBlocks = tpl.timeBlocks.map(b => ({
          ...b,
          id: `${record.date}-${b.time}`
      }));
      
      const newRecord = { 
          ...record, 
          primaryTasks: tpl.primaryTasks,
          timeBlocks: newBlocks 
      };
      
      onUpdateRecord(newRecord);
      await saveDailyRecord(newRecord);
      setShowTemplateModal(false);
  };

  // --- Editor Logic ---
  const openEditor = (block: TimeBlock | null, type: 'plan' | 'do' | 'check', defaultTime?: string) => {
    // Bio Lock Check
    if (block && block.plan.isBioLocked) return;

    setEditType(type);
    if (block) {
        setSelectedBlockId(block.id);
        const currentIdx = record.timeBlocks.findIndex(b => b.id === block.id);
        const nextBlock = record.timeBlocks[currentIdx + 1];
        const defaultEnd = nextBlock ? nextBlock.time : minutesToTime(timeToMinutes(block.time) + 60);

        if (type === 'plan') {
            setEditContent(block.plan.content);
            setEditStartTime(block.plan.startTime || block.time);
            setEditEndTime(block.plan.endTime || defaultEnd);
        } else if (type === 'do') {
            // Updated logic: Only auto-fill if status is completed or content exists
            const initialContent = block.do.actualContent || (block.do.status === 'completed' ? block.plan.content : '');
            setEditContent(initialContent);
            setEditStatus(block.do.status);
            setEditStartTime(block.do.startTime || block.time);
            setEditEndTime(block.do.endTime || defaultEnd);
        } else if (type === 'check') {
            setEditContent(block.check.comment);
            setEditEfficiency(block.check.efficiency);
            setEditStartTime(block.time);
            setEditEndTime(defaultEnd);
        }
    } else {
        setSelectedBlockId('NEW');
        setEditContent('');
        setEditStatus('completed');
        setEditEfficiency(null);
        const now = new Date();
        const currentH = now.getHours().toString().padStart(2, '0');
        const defaultStart = defaultTime || `${currentH}:00`;
        setEditStartTime(defaultStart);
        const endMin = timeToMinutes(defaultStart) + 60;
        setEditEndTime(minutesToTime(endMin));
    }
  };

  const saveBlock = () => {
    const startMin = timeToMinutes(editStartTime);
    const endMin = timeToMinutes(editEndTime);
    if (endMin <= startMin) { alert("结束时间必须晚于开始时间"); return; }

    const newBlocks = record.timeBlocks.map(b => {
      const blockStart = timeToMinutes(b.time);
      const currentIdx = record.timeBlocks.findIndex(x => x.id === b.id);
      const nextBlock = record.timeBlocks[currentIdx + 1];
      const blockEnd = nextBlock ? timeToMinutes(nextBlock.time) : blockStart + 60;

      const isOverlapping = (startMin < blockEnd) && (endMin > blockStart);
      if (!isOverlapping) return b;

      const newB = { ...b };
      const isStartBlock = (startMin >= blockStart && startMin < blockEnd);

      if (editType === 'plan') {
        if (newB.plan.isBioLocked) return b;
        let contentToSet = editContent;
        let timePrefix = "";
        if (isStartBlock && editStartTime !== b.time) {
             timePrefix = `[${editStartTime}] `;
        }
        const fullContent = timePrefix + contentToSet;
        if (selectedBlockId === 'NEW' && newB.plan.content) newB.plan.content = newB.plan.content + "\n" + fullContent;
        else if (selectedBlockId !== 'NEW' && b.id === selectedBlockId) { newB.plan.content = contentToSet; if(editStartTime !== b.time) newB.plan.startTime = editStartTime; } 
        else { if (newB.plan.content) { if(!newB.plan.content.includes(contentToSet)) newB.plan.content = newB.plan.content + "\n" + fullContent; } else { newB.plan.content = fullContent; } }
        if (isStartBlock) newB.plan.endTime = editEndTime; 
      } else if (editType === 'do') {
        let contentToSet = editContent;
        let timePrefix = "";
        if (isStartBlock && editStartTime !== b.time) timePrefix = `[${editStartTime}] `;
        const fullContent = timePrefix + contentToSet;
        if (selectedBlockId === 'NEW' && newB.do.actualContent) newB.do.actualContent = newB.do.actualContent + "\n" + fullContent;
        else if (selectedBlockId !== 'NEW' && b.id === selectedBlockId) { newB.do.actualContent = contentToSet; newB.do.status = editStatus; if(editStartTime !== b.time) newB.do.startTime = editStartTime; }
        else { if (newB.do.actualContent) { if(!newB.do.actualContent.includes(contentToSet)) newB.do.actualContent = newB.do.actualContent + "\n" + fullContent; } else { newB.do.actualContent = fullContent; newB.do.status = editStatus; } }
        if (isStartBlock) newB.do.endTime = editEndTime;
      } else if (editType === 'check' && selectedBlockId === b.id) {
          newB.check.comment = editContent; newB.check.efficiency = editEfficiency;
      }
      return newB;
    });

    const newRecord = { ...record, timeBlocks: newBlocks };
    onUpdateRecord(newRecord);
    saveDailyRecord(newRecord);
    setSelectedBlockId(null);
  };
  
  // --- Rendering Helpers ---

  // Calculate spans for rendering grid
  // We use the stored `span` property. 0 means don't render. >0 means render.
  
  return (
    <div className="space-y-6 pb-20 relative">
      {/* Principal Tasks Banner */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Flag className="w-32 h-32" />
        </div>
        
        <div className="relative z-10 flex justify-between items-start mb-3">
             <h3 className="text-brand-100 text-sm font-semibold uppercase tracking-wider">今日主要任务 (Core Tasks)</h3>
             <div className="flex gap-2">
                 <button onClick={handleOpenTemplates} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white flex items-center gap-1" title="模板">
                    <LayoutTemplate className="w-4 h-4"/> 模板
                 </button>
                 <button onClick={handleExport} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white" title="导出 CSV"><FileDown className="w-4 h-4"/></button>
                 {!isEditingPrincipal ? (
                     <button onClick={() => setIsEditingPrincipal(true)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"><Edit3 className="w-4 h-4" /></button>
                 ) : (
                    <button onClick={savePrincipalTasks} className="p-1.5 bg-green-500/80 hover:bg-green-500 rounded-lg transition-colors text-white shadow-sm"><Save className="w-4 h-4" /></button>
                 )}
             </div>
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
                   <input value={tempP1} onChange={(e) => setTempP1(e.target.value)} placeholder="任务 1..." className="bg-transparent border-none outline-none text-white placeholder-white/40 w-full font-medium text-lg focus:ring-0" autoFocus />
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 p-2 rounded-lg flex items-center gap-3">
                   <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">2</div>
                   <input value={tempP2} onChange={(e) => setTempP2(e.target.value)} placeholder="任务 2..." className="bg-transparent border-none outline-none text-white placeholder-white/40 w-full font-medium text-lg focus:ring-0" />
                </div>
             </>
          )}
        </div>
      </div>

      {/* Tri-Track Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        {/* Header */}
        <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600 sticky top-0 z-20 shadow-sm">
          <div className="col-span-2 md:col-span-1 p-3 text-center border-r border-slate-200">时间</div>
          <div className="col-span-4 md:col-span-5 p-3 border-r border-slate-200 pl-4 flex justify-between items-center">
              计划 (Plan)
              <button onClick={() => openEditor(null, 'plan')} className="text-xs font-normal text-brand-600 bg-brand-50 px-2 py-1 rounded hover:bg-brand-100 flex items-center gap-1">
                  <Plus className="w-3 h-3"/> 添加
              </button>
          </div>
          <div className="col-span-4 md:col-span-5 p-3 border-r border-slate-200 pl-4 flex justify-between items-center">
              执行 (Do)
               <button onClick={() => openEditor(null, 'do')} className="text-xs font-normal text-brand-600 bg-brand-50 px-2 py-1 rounded hover:bg-brand-100 flex items-center gap-1">
                  <Plus className="w-3 h-3"/> 添加
              </button>
          </div>
          <div className="col-span-2 md:col-span-1 p-3 text-center">检查</div>
        </div>

        {/* Flat Grid Content with Row Spans */}
        <div className="grid grid-cols-12 auto-rows-fr">
          {visibleBlocks.map((block, idx) => {
             const isLocked = block.plan.isBioLocked;
             
             // Defaults (safe navigation)
             const planSpan = block.plan.span ?? 1;
             const doSpan = block.do.span ?? 1;
             // Check spans same as Do
             const checkSpan = doSpan; 

             // Handle Rendering Logic
             const renderPlan = planSpan > 0;
             const renderDo = doSpan > 0;
             const renderCheck = checkSpan > 0; // Sync Check with Do

             // Determine next blocks for Handles
             const canMergePlanDown = planSpan > 0 && (idx + planSpan) < visibleBlocks.length;
             const canSplitPlan = planSpan > 1;

             const canMergeDoDown = doSpan > 0 && (idx + doSpan) < visibleBlocks.length;
             const canSplitDo = doSpan > 1;

             return (
              <React.Fragment key={block.id}>
                {/* Time Column (Always Render, 1x height) */}
                <div className={`col-span-2 md:col-span-1 py-3 text-xs md:text-sm text-slate-400 text-center font-mono border-r border-b border-slate-200 flex flex-col items-center justify-center relative group/time hover:bg-slate-50`}>
                   {block.time}
                   {!isLocked && (
                       <div className="absolute hidden group-hover/time:flex flex-col gap-1 z-10 bg-white shadow rounded border border-slate-100 p-0.5 top-0 right-0">
                           <button 
                                onClick={() => { setSplitTargetId(block.id); setSplitTime(minutesToTime(timeToMinutes(block.time) + 15)); }}
                                className="p-1 text-slate-400 hover:text-brand-600"
                                title="拆分时间段"
                            >
                                <Scissors className="w-3 h-3" />
                            </button>
                            <button 
                                onClick={() => handleDeleteTime(block.id)}
                                className="p-1 text-slate-400 hover:text-red-600"
                                title="删除时间段"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                       </div>
                   )}
                </div>

                {/* Plan Column */}
                {renderPlan && (
                    <div 
                        style={{ gridRow: `span ${planSpan}` }}
                        className={`col-span-4 md:col-span-5 p-2 md:p-3 border-r border-b border-slate-200 text-sm relative group/cell flex flex-col justify-center ${isLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed italic' : 'hover:bg-blue-50/50'}`}
                    >
                        <div className={`flex-1 cursor-pointer whitespace-pre-wrap ${isLocked ? 'pointer-events-none' : ''}`} onClick={() => openEditor(block, 'plan')}>
                            {block.plan.startTime && block.plan.startTime !== block.time && !block.plan.content.includes('[') && (
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded mr-1 font-mono">{block.plan.startTime}~</span>
                            )}
                            {block.plan.content}
                        </div>
                        {isLocked && <span className="absolute right-2 top-3 text-xs text-slate-300">BIO</span>}
                        
                        {/* Copy/Paste Controls */}
                        {!isLocked && (
                            <div className="absolute right-2 top-2 hidden group-hover/cell:flex gap-1 bg-white/80 rounded z-10">
                                {block.plan.content && <button onClick={(e) => handleCopy(block.plan.content, undefined, 'plan', e)} className="p-1.5 shadow-sm border border-slate-200 rounded text-slate-500 hover:text-brand-600"><Copy className="w-3 h-3"/></button>}
                                {clipboard && clipboard.type === 'plan' && <button onClick={(e) => handlePaste(block.id, 'plan', e)} className="p-1.5 shadow-sm border border-slate-200 rounded text-slate-500 hover:text-brand-600"><ClipboardPaste className="w-3 h-3"/></button>}
                            </div>
                        )}

                        {/* Merge/Split Handle */}
                        {!isLocked && (
                             <div className="absolute bottom-0 left-0 w-full h-1 flex justify-center items-center gap-1 z-20 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                {canSplitPlan && (
                                    <button onClick={() => handleMergeAction(block.id, 'plan', 'split')} className="bg-white border border-slate-300 text-red-500 rounded-full p-0.5 shadow-sm hover:bg-red-50 -mb-2.5" title="拆分单元格"><Unlink className="w-3 h-3"/></button>
                                )}
                                {canMergePlanDown && (
                                    <button onClick={() => handleMergeAction(block.id, 'plan', 'merge')} className="bg-white border border-slate-300 text-brand-500 rounded-full p-0.5 shadow-sm hover:bg-brand-50 -mb-2.5" title="合并下一行"><Link className="w-3 h-3"/></button>
                                )}
                             </div>
                        )}
                    </div>
                )}

                {/* Do Column */}
                {renderDo && (
                    <div 
                        style={{ gridRow: `span ${doSpan}` }}
                        className={`col-span-4 md:col-span-5 p-2 md:p-3 border-r border-b border-slate-200 text-sm relative group/cell border-l-4 flex flex-col justify-center ${isLocked ? 'bg-slate-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                    >
                         <div 
                             className={`h-full w-full rounded px-2 py-1 flex items-center relative ${getStatusColor(block.do.status)} min-h-[2rem] whitespace-pre-wrap ${isLocked ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                             onClick={() => openEditor(block, 'do')}
                         >
                            {block.do.startTime && block.do.startTime !== block.time && !block.do.actualContent.includes('[') && (
                                <span className="text-[10px] bg-white/50 text-slate-700 px-1 rounded mr-1 font-mono">{block.do.startTime}~</span>
                            )}
                            {block.do.actualContent || (block.do.status === 'none' && !isLocked ? <span className="opacity-0 group-hover:opacity-100 text-slate-300">点击记录</span> : '')}
                        </div>

                         <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/cell:flex gap-1 bg-white/80 rounded z-10">
                            {block.do.actualContent && <button onClick={(e) => handleCopy(block.do.actualContent, block.do.status, 'do', e)} className="p-1.5 shadow-sm border border-slate-200 rounded text-slate-500 hover:text-brand-600"><Copy className="w-3 h-3"/></button>}
                            {clipboard && clipboard.type === 'do' && <button onClick={(e) => handlePaste(block.id, 'do', e)} className="p-1.5 shadow-sm border border-slate-200 rounded text-slate-500 hover:text-brand-600"><ClipboardPaste className="w-3 h-3"/></button>}
                        </div>

                         {/* Merge/Split Handle */}
                        {!isLocked && (
                             <div className="absolute bottom-0 left-0 w-full h-1 flex justify-center items-center gap-1 z-20 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                {canSplitDo && (
                                    <button onClick={() => handleMergeAction(block.id, 'do', 'split')} className="bg-white border border-slate-300 text-red-500 rounded-full p-0.5 shadow-sm hover:bg-red-50 -mb-2.5" title="拆分单元格"><Unlink className="w-3 h-3"/></button>
                                )}
                                {canMergeDoDown && (
                                    <button onClick={() => handleMergeAction(block.id, 'do', 'merge')} className="bg-white border border-slate-300 text-brand-500 rounded-full p-0.5 shadow-sm hover:bg-brand-50 -mb-2.5" title="合并下一行"><Link className="w-3 h-3"/></button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Check Column (Synced with Do) */}
                {renderCheck && (
                     <div 
                        style={{ gridRow: `span ${checkSpan}` }}
                        onClick={() => openEditor(block, 'check')} 
                        className={`col-span-2 md:col-span-1 p-2 border-r border-b border-slate-200 flex flex-col items-center justify-center group/check ${isLocked ? 'bg-slate-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer hover:bg-slate-100'}`}
                        title={block.check.comment ? `检查: ${block.check.comment} (效率: ${EFFICIENCY_LABELS[block.check.efficiency || 'null']})` : '点击填写检查'}
                    >
                        <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full ${getEfficiencyColor(block.check.efficiency)} ${isLocked ? 'opacity-30' : ''}`}></div>
                        {block.check.comment && (
                            <span className="text-[10px] text-slate-400 mt-1 max-w-full truncate px-1 hidden md:block group-hover/check:text-slate-600">{block.check.comment}</span>
                        )}
                    </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* FAB Layout */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-30 flex flex-col gap-4 items-center">
        <button
            onClick={() => openEditor(null, 'plan')}
            className="w-14 h-14 bg-white text-brand-600 shadow-xl border-2 border-brand-100 rounded-full flex items-center justify-center transition-transform hover:scale-110"
            title="快速添加"
        >
            <Plus className="w-7 h-7" />
        </button>

        <button 
           onClick={onOpenAct}
           className="w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white shadow-xl shadow-brand-200 rounded-full flex items-center justify-center transition-transform hover:scale-110"
           title="结束今日"
        >
            <Edit3 className="w-6 h-6" />
        </button>
      </div>

      {/* Split Block Modal */}
      {splitTargetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]" onClick={() => setSplitTargetId(null)}>
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2"><Scissors className="w-5 h-5"/> 拆分时间段</h3>
                  <p className="text-sm text-slate-500 mb-4">将在当前时间块之后插入一个新的起始点。如果存在 [HH:MM] 格式的内容，将自动迁移。</p>
                  <input 
                      type="time" 
                      value={splitTime}
                      onChange={(e) => setSplitTime(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg text-lg font-mono mb-6"
                  />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setSplitTargetId(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">取消</button>
                      <button onClick={handleSplitBlock} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">确认拆分</button>
                  </div>
              </div>
          </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]" onClick={() => setShowTemplateModal(false)}>
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2"><LayoutTemplate className="w-5 h-5"/> 日程模板管理</h3>
                  
                  {/* Save Current */}
                  <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">将当前日程保存为模板</label>
                      <div className="flex gap-2">
                          <input 
                              value={newTemplateName}
                              onChange={(e) => setNewTemplateName(e.target.value)}
                              placeholder="输入模板名称 (如: 标准工作日)"
                              className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-brand-500"
                          />
                          <button onClick={saveCurrentAsTemplate} disabled={!newTemplateName} className="px-3 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1">
                              <Download className="w-4 h-4"/> 保存
                          </button>
                      </div>
                  </div>

                  {/* Load Template */}
                  <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">加载模板</label>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                          {templates.length === 0 ? <div className="text-center text-slate-400 text-sm py-2">暂无模板</div> : 
                            templates.map(tpl => (
                                <div key={tpl.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded hover:border-brand-300">
                                    <span className="font-medium text-slate-700">{tpl.name}</span>
                                    <button onClick={() => loadTemplate(tpl)} className="px-3 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-brand-50 text-slate-600 flex items-center gap-1">
                                        <Upload className="w-3 h-3"/> 应用
                                    </button>
                                </div>
                            ))
                          }
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                      <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">关闭</button>
                  </div>
              </div>
          </div>
      )}

      {/* Editor Modal (Keep existing logic) */}
      {selectedBlockId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]" onClick={() => setSelectedBlockId(null)}>
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4 text-slate-800 capitalize flex items-center gap-2">
                  {editType === 'plan' && <Clock className="w-5 h-5 text-brand-500"/>}
                  {editType === 'do' && <Edit3 className="w-5 h-5 text-green-500"/>}
                  编辑 {getEditTitle(editType)}
              </h3>
              
              <div className="space-y-4">
                  {selectedBlockId === 'NEW' && (
                      <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                          <button onClick={() => setEditType('plan')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${editType === 'plan' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}>计划 (Plan)</button>
                          <button onClick={() => { setEditType('do'); setEditStatus('completed'); }} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${editType === 'do' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}>执行 (Do)</button>
                      </div>
                  )}

                  <div className="flex gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">开始时间</label>
                          <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-brand-500 outline-none"/>
                      </div>
                      <div className="flex items-end pb-1 text-slate-300">→</div>
                      <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">结束时间</label>
                           <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-brand-500 outline-none"/>
                      </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">内容</label>
                    <textarea autoFocus className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none resize-none h-24" value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="要做什么..."/>
                  </div>

                  {editType === 'do' && selectedBlockId !== 'NEW' && (
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2">执行状态</label>
                        <div className="flex flex-wrap gap-2">
                            {(['completed', 'partial', 'changed', 'skipped'] as const).map(s => (
                                <button key={s} 
                                    onClick={() => { 
                                        setEditStatus(s);
                                        // If switching to completed, auto-fill plan content if available
                                        if (s === 'completed' && selectedBlockId) {
                                            const currentBlock = record.timeBlocks.find(b => b.id === selectedBlockId);
                                            if (currentBlock && !editContent) {
                                                setEditContent(currentBlock.plan.content);
                                            }
                                        }
                                    }} 
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
                                    <button onClick={() => setEditEfficiency(e)} className={`w-8 h-8 rounded-full ring-2 ring-offset-2 ${editEfficiency === e ? 'ring-brand-500' : 'ring-transparent'} ${getEfficiencyColor(e)}`}/>
                                    <span className="text-xs text-slate-500">{EFFICIENCY_LABELS[e]}</span>
                                </div>
                            ))}
                         </div>
                     </div>
                  )}

                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setSelectedBlockId(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">取消</button>
                      <button onClick={saveBlock} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-lg shadow-brand-100">保存</button>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DailyView;
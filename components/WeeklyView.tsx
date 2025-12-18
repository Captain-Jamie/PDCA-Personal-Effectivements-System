import React, { useState, useEffect } from 'react';
import { WeeklyPlan, DailyRecord } from '../types';
import { getWeeklyPlan, saveWeeklyPlan, getWeekId, getMondayOfWeek, getDailyRecord, getDailyRecordsRange, saveDailyRecord, exportToCSV } from '../services/storage';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Calendar, Target, TrendingUp, ChevronLeft, ChevronRight, Edit3, Save, X, Loader2, BookOpen, AlertCircle, FileDown, CheckCircle2 } from 'lucide-react';

interface WeeklyViewProps {
  currentDate: Date;
}

const WeeklyView: React.FC<WeeklyViewProps> = ({ currentDate }) => {
  // Navigation State
  const [displayDate, setDisplayDate] = useState<Date>(new Date(currentDate));
  
  // Data State
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [weekDailyRecords, setWeekDailyRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState<WeeklyPlan | null>(null);
  
  // Weekly Summary Edit State (Separate from Plan Edit)
  const [weeklySummaryEdit, setWeeklySummaryEdit] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);

  // Detail Modal State
  const [selectedDayDetail, setSelectedDayDetail] = useState<DailyRecord | null>(null);
  const [isEditingDetailSummary, setIsEditingDetailSummary] = useState(false);
  const [detailSummaryEdit, setDetailSummaryEdit] = useState('');

  // Derived state
  const weekId = getWeekId(displayDate);
  const mondayDateStr = getMondayOfWeek(displayDate);
  
  // Generate date objects for the current view week
  const weekDates: string[] = [];
  const start = new Date(mondayDateStr);
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  for (let i = 0; i < 7; i++) {
     const d = new Date(start);
     d.setDate(start.getDate() + i);
     weekDates.push(d.toISOString().split('T')[0]);
  }

  // Load Plan when week changes
  useEffect(() => {
    const fetchPlanAndRecords = async () => {
        setLoading(true);
        try {
            const loadedPlan = await getWeeklyPlan(weekId);
            if (!loadedPlan.startDate) loadedPlan.startDate = mondayDateStr;
            setPlan(loadedPlan);
            setEditedPlan(loadedPlan);
            setWeeklySummaryEdit(loadedPlan.weeklySummary);
            setIsEditing(false);

            // Fetch daily records for the whole week to show summaries
            const records = await getDailyRecordsRange(weekDates[0], weekDates[6]);
            setWeekDailyRecords(records);

        } finally {
            setLoading(false);
        }
    };
    fetchPlanAndRecords();
  }, [weekId, mondayDateStr]);

  const handleWeekChange = (offset: number) => {
    const newDate = new Date(displayDate);
    newDate.setDate(newDate.getDate() + (offset * 7));
    setDisplayDate(newDate);
  };

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.value;
      if(picked) {
          setDisplayDate(new Date(picked));
      }
  };

  const handleSave = async () => {
    if (editedPlan) {
        setLoading(true);
        await saveWeeklyPlan(editedPlan);
        setPlan(editedPlan);
        setIsEditing(false);
        setLoading(false);
    }
  };
  
  const saveWeeklySummaryOnly = async () => {
      if(!plan) return;
      const updated = { ...plan, weeklySummary: weeklySummaryEdit };
      await saveWeeklyPlan(updated);
      setPlan(updated);
      setIsEditingSummary(false);
  };

  const handleCancel = () => {
    setEditedPlan(plan);
    setIsEditing(false);
  };

  const updatePreset = (dateStr: string, index: 0 | 1, value: string) => {
    if (!editedPlan) return;
    const currentPresets = editedPlan.dailyPresets[dateStr] || ['', ''];
    const newPresets: [string, string] = [...currentPresets] as [string, string];
    newPresets[index] = value;
    setEditedPlan({
        ...editedPlan,
        dailyPresets: {
            ...editedPlan.dailyPresets,
            [dateStr]: newPresets
        }
    });
  };

  const handleExportWeek = () => {
      if (!plan) return;

      const rows: string[][] = [];
      rows.push(["Week ID", plan.weekId || '', "Theme", plan.theme || '']);
      rows.push(["Weekly Summary", plan.weeklySummary || '']);
      rows.push([]);
      rows.push(["Date", "Day", "Task 1", "Task 2", "Daily Summary"]);
      
      weekDates.forEach((date, i) => {
          const tasks = plan.dailyPresets[date] || ['', ''];
          const rec = weekDailyRecords.find(r => r.date === date);
          const summary = rec?.daySummary || '';
          
          rows.push([
              date,
              days[i],
              tasks[0] || '',
              tasks[1] || '',
              summary.replace(/\n/g, ' ')
          ]);
      });
      
      exportToCSV(`PDCA_Weekly_${plan.weekId}.csv`, rows);
  };

  const loadDayDetail = async (dateStr: string) => {
    let record = weekDailyRecords.find(r => r.date === dateStr);
    if (!record) {
        record = await getDailyRecord(dateStr);
    }
    setSelectedDayDetail(record);
    setDetailSummaryEdit(record.daySummary || '');
    setIsEditingDetailSummary(false);
  };

  const handleSaveDetailSummary = async () => {
      if (!selectedDayDetail) return;
      const updated = { ...selectedDayDetail, daySummary: detailSummaryEdit };
      await saveDailyRecord(updated);
      
      // Update local states
      setSelectedDayDetail(updated);
      setWeekDailyRecords(prev => prev.map(r => r.date === updated.date ? updated : r));
      setIsEditingDetailSummary(false);
  };

  if (loading || !plan || !editedPlan) return <div className="p-8 flex justify-center text-slate-500"><Loader2 className="animate-spin w-8 h-8"/></div>;

  const daysLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => handleWeekChange(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
                <div className="text-center relative group cursor-pointer" title="点击选择日期跳转">
                    <input type="date" value={mondayDateStr} onChange={handleDatePick} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"/>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 justify-center group-hover:text-brand-600 transition-colors">
                         第 {weekId.split('-W')[1]} 周 <span className="text-lg font-normal text-slate-400">({weekId.split('-W')[0]})</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1 group-hover:text-brand-400">{mondayDateStr} 至 {weekDates[6]}</p>
                </div>
                <button onClick={() => handleWeekChange(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="flex gap-2">
                <button onClick={handleExportWeek} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors shadow-sm"><FileDown className="w-4 h-4"/> 导出</button>
                {!isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors shadow-sm"><Edit3 className="w-4 h-4" /> 编辑计划</button>
                ) : (
                    <>
                        <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"><X className="w-4 h-4" /> 取消</button>
                        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors shadow-md"><Save className="w-4 h-4" /> 保存计划</button>
                    </>
                )}
            </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <span className="font-bold text-slate-700 whitespace-nowrap flex items-center gap-2"><Target className="w-5 h-5 text-brand-500" /> 本周核心主题:</span>
                {isEditing ? (
                    <input value={editedPlan.theme} onChange={(e) => setEditedPlan({...editedPlan, theme: e.target.value})} placeholder="例如：基础建设周、高产出周..." className="flex-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"/>
                ) : (
                    <span className="text-lg text-slate-800 font-medium">{plan.theme || <span className="text-slate-400 italic">未设置主题</span>}</span>
                )}
            </div>
        </div>
      </div>

      {/* 7-Day Matrix + Weekly Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Col: Daily Plan Matrix */}
         <div className="lg:col-span-2 space-y-6">
             <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-5 h-5 text-brand-600" /> 每日计划</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekDates.map((dateStr, idx) => {
                    const dayName = daysLabels[idx];
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;
                    const currentData = isEditing ? editedPlan : plan;
                    const tasks = currentData.dailyPresets[dateStr] || ['', ''];
                    const hasSummary = weekDailyRecords.find(r => r.date === dateStr)?.daySummary;

                    return (
                        <div key={dateStr} className={`p-4 rounded-xl border flex flex-col ${isToday ? 'border-brand-500 bg-brand-50 shadow-md ring-1 ring-brand-500' : 'border-slate-200 bg-white shadow-sm'}`}>
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <span className={`font-bold ${isToday ? 'text-brand-800' : 'text-slate-700'}`}>{dayName}</span>
                                    <div className="text-xs text-slate-400 font-mono">{dateStr.slice(5)}</div>
                                </div>
                                {!isEditing && (
                                    <button onClick={() => loadDayDetail(dateStr)} className={`p-1.5 rounded transition-colors ${hasSummary ? 'text-brand-600 bg-brand-100 hover:bg-brand-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`} title="查看详情与复盘">
                                        <BookOpen className="w-4 h-4"/>
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                                    {isEditing ? (
                                        <input value={tasks[0]} onChange={(e) => updatePreset(dateStr, 0, e.target.value)} className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-brand-500 outline-none"/>
                                    ) : (
                                        <span className={`text-sm truncate ${tasks[0] ? 'text-slate-700' : 'text-slate-300 italic'}`}>{tasks[0] || '空'}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                                    {isEditing ? (
                                        <input value={tasks[1]} onChange={(e) => updatePreset(dateStr, 1, e.target.value)} className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-brand-500 outline-none"/>
                                    ) : (
                                        <span className={`text-sm truncate ${tasks[1] ? 'text-slate-700' : 'text-slate-300 italic'}`}>{tasks[1] || '空'}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
             </div>
         </div>

         {/* Right Col: Weekly Review & Summary */}
         <div className="space-y-6">
             {/* Weekly Summary (Editable) */}
             <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[300px]">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Target className="w-5 h-5 text-brand-600"/> 本周复盘与目标</h3>
                     {!isEditingSummary ? (
                         <button onClick={() => setIsEditingSummary(true)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-brand-600"><Edit3 className="w-4 h-4"/></button>
                     ) : (
                         <button onClick={saveWeeklySummaryOnly} className="p-1 hover:bg-green-100 rounded text-green-600"><Save className="w-4 h-4"/></button>
                     )}
                </div>
                {isEditingSummary ? (
                    <textarea value={weeklySummaryEdit} onChange={(e) => setWeeklySummaryEdit(e.target.value)} className="flex-1 w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" placeholder="本周主要的产出和下周的调整..."/>
                ) : (
                    <div className="flex-1 overflow-y-auto p-3 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">{plan.weeklySummary || <span className="text-slate-400 italic">未填写周总结</span>}</div>
                )}
             </div>

             {/* Daily Summaries List */}
             <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 max-h-[500px] overflow-hidden flex flex-col">
                 <h3 className="font-bold text-slate-800 mb-4">本周每日回顾</h3>
                 <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                     {weekDailyRecords.filter(r => r.daySummary).length > 0 ? (
                         weekDailyRecords.filter(r => r.daySummary).sort((a, b) => a.date.localeCompare(b.date)).map(r => (
                             <div key={r.date} className="text-sm border-l-2 border-brand-300 pl-3">
                                 <div className="text-xs font-bold text-slate-500 mb-1">{r.date} {daysLabels[new Date(r.date).getDay() === 0 ? 6 : new Date(r.date).getDay() - 1]}</div>
                                 <p className="text-slate-700 line-clamp-4 hover:line-clamp-none transition-all">{r.daySummary}</p>
                             </div>
                         ))
                     ) : (
                         <div className="text-center text-slate-400 text-sm py-4">暂无每日总结</div>
                     )}
                 </div>
             </div>
         </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDayDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]" onClick={() => setSelectedDayDetail(null)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                      <div>
                          <h3 className="font-bold text-lg text-slate-800">{selectedDayDetail.date} 详情</h3>
                      </div>
                      <button onClick={() => setSelectedDayDetail(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                          <div className="flex justify-between items-center mb-2">
                             <h4 className="text-blue-900 font-bold flex items-center gap-2"><BookOpen className="w-4 h-4"/> 每日总结</h4>
                             {!isEditingDetailSummary ? (
                                <button onClick={() => setIsEditingDetailSummary(true)} className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors" title="编辑总结">
                                    <Edit3 className="w-4 h-4"/>
                                </button>
                             ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditingDetailSummary(false)} className="p-1 hover:bg-red-100 rounded text-red-500 transition-colors">
                                        <X className="w-4 h-4"/>
                                    </button>
                                    <button onClick={handleSaveDetailSummary} className="p-1 hover:bg-green-100 rounded text-green-600 transition-colors">
                                        <CheckCircle2 className="w-4 h-4"/>
                                    </button>
                                </div>
                             )}
                          </div>
                          
                          {isEditingDetailSummary ? (
                              <textarea 
                                autoFocus
                                value={detailSummaryEdit}
                                onChange={(e) => setDetailSummaryEdit(e.target.value)}
                                className="w-full h-32 p-3 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                                placeholder="填写今日复盘总结..."
                              />
                          ) : (
                              <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed" onClick={() => setIsEditingDetailSummary(true)}>
                                  {selectedDayDetail.daySummary || <span className="text-slate-400 italic cursor-pointer">点击填写今日总结</span>}
                              </p>
                          )}
                      </div>
                      
                      {/* Detailed Check Logs */}
                      <div>
                          <h4 className="text-slate-800 font-bold mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-brand-500"/> 执行与检查</h4>
                          <div className="space-y-2">
                            {selectedDayDetail.timeBlocks.filter(b => b.do.actualContent || b.check.comment).length > 0 ? (
                                selectedDayDetail.timeBlocks.filter(b => b.do.actualContent || b.check.comment).map(b => (
                                    <div key={b.id} className="grid grid-cols-12 gap-2 text-sm border-b border-slate-50 pb-2">
                                        <div className="col-span-2 font-mono text-slate-400 font-bold">{b.time}</div>
                                        <div className="col-span-10 space-y-1">
                                            {b.do.actualContent && <div className="bg-blue-50/50 p-1 rounded text-slate-700"><span className="text-[10px] text-blue-400 font-bold mr-1">DO</span>{b.do.actualContent}</div>}
                                            {b.check.comment && <div className="bg-yellow-50/50 p-1 rounded text-slate-700"><span className="text-[10px] text-yellow-500 font-bold mr-1">CHK</span>{b.check.comment}</div>}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-slate-400 text-xs py-4">当日无具体的执行或检查记录</div>
                            )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default WeeklyView;
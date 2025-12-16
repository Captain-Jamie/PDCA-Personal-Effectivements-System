import React, { useState, useEffect } from 'react';
import { WeeklyPlan, DailyRecord } from '../types';
import { getWeeklyPlan, saveWeeklyPlan, getWeekId, getMondayOfWeek, getDailyRecord } from '../services/storage';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Calendar, Target, TrendingUp, ChevronLeft, ChevronRight, Edit3, Save, X, Loader2, BookOpen, AlertCircle } from 'lucide-react';

interface WeeklyViewProps {
  currentDate: Date;
}

const WeeklyView: React.FC<WeeklyViewProps> = ({ currentDate }) => {
  // Navigation State
  const [displayDate, setDisplayDate] = useState<Date>(new Date(currentDate));
  
  // Data State
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState<WeeklyPlan | null>(null);

  // Detail Modal State
  const [selectedDayDetail, setSelectedDayDetail] = useState<DailyRecord | null>(null);

  // Derived state
  const weekId = getWeekId(displayDate);
  const mondayDateStr = getMondayOfWeek(displayDate);

  // Load Plan when week changes
  useEffect(() => {
    const fetchPlan = async () => {
        setLoading(true);
        try {
            const loadedPlan = await getWeeklyPlan(weekId);
            // Ensure the plan has the correct start date if it's new
            if (!loadedPlan.startDate) {
                loadedPlan.startDate = mondayDateStr;
            }
            setPlan(loadedPlan);
            setEditedPlan(loadedPlan);
            setIsEditing(false);
        } finally {
            setLoading(false);
        }
    };
    fetchPlan();
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

  const loadDayDetail = async (dateStr: string) => {
      // Fetch the actual daily record to see summary and checks
      const record = await getDailyRecord(dateStr);
      setSelectedDayDetail(record);
  };

  if (loading || !plan || !editedPlan) return <div className="p-8 flex justify-center text-slate-500"><Loader2 className="animate-spin w-8 h-8"/></div>;

  // Chart Mock Data (Visualization Only for MVP)
  const chartData = [
    { name: '周一', completed: 0, planned: 100 },
    { name: '周二', completed: 0, planned: 100 },
    { name: '周三', completed: 0, planned: 100 },
    { name: '周四', completed: 0, planned: 100 },
    { name: '周五', completed: 0, planned: 100 },
    { name: '周六', completed: 0, planned: 50 },
    { name: '周日', completed: 0, planned: 30 },
  ];

  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  
  // Generate date objects for the current view week
  const weekDates: string[] = [];
  const start = new Date(mondayDateStr);
  for (let i = 0; i < 7; i++) {
     const d = new Date(start);
     d.setDate(start.getDate() + i);
     weekDates.push(d.toISOString().split('T')[0]);
  }

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-6">
        
        {/* Top Bar: Navigation and Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => handleWeekChange(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="text-center relative group cursor-pointer" title="点击选择日期跳转">
                    <input 
                        type="date"
                        value={mondayDateStr}
                        onChange={handleDatePick}
                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                    />
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 justify-center group-hover:text-brand-600 transition-colors">
                         第 {weekId.split('-W')[1]} 周 <span className="text-lg font-normal text-slate-400">({weekId.split('-W')[0]})</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1 group-hover:text-brand-400">{mondayDateStr} 至 {weekDates[6]}</p>
                </div>

                <button onClick={() => handleWeekChange(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-2">
                {!isEditing ? (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors shadow-sm"
                    >
                        <Edit3 className="w-4 h-4" /> 编辑计划
                    </button>
                ) : (
                    <>
                        <button 
                            onClick={handleCancel}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                        >
                            <X className="w-4 h-4" /> 取消
                        </button>
                        <button 
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors shadow-md"
                        >
                            <Save className="w-4 h-4" /> 保存计划
                        </button>
                    </>
                )}
            </div>
        </div>

        {/* Theme Section */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <span className="font-bold text-slate-700 whitespace-nowrap flex items-center gap-2">
                    <Target className="w-5 h-5 text-brand-500" /> 本周核心主题 (Theme):
                </span>
                {isEditing ? (
                    <input 
                        value={editedPlan.theme}
                        onChange={(e) => setEditedPlan({...editedPlan, theme: e.target.value})}
                        placeholder="例如：基础建设周、高产出周..."
                        className="flex-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                ) : (
                    <span className="text-lg text-slate-800 font-medium">{plan.theme || <span className="text-slate-400 italic">未设置主题</span>}</span>
                )}
            </div>
        </div>
      </div>

      {/* 7-Day Planning Matrix */}
      <div>
         <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
             <Calendar className="w-5 h-5 text-brand-600" /> 每日复盘与计划
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {weekDates.map((dateStr, idx) => {
                const dayName = days[idx];
                const isToday = new Date().toISOString().split('T')[0] === dateStr;
                // Use edited plan if editing, else view plan
                const currentData = isEditing ? editedPlan : plan;
                const tasks = currentData.dailyPresets[dateStr] || ['', ''];

                return (
                    <div key={dateStr} className={`p-4 rounded-xl border flex flex-col h-full ${isToday ? 'border-brand-500 bg-brand-50 shadow-md ring-1 ring-brand-500' : 'border-slate-200 bg-white shadow-sm'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <span className={`font-bold ${isToday ? 'text-brand-800' : 'text-slate-700'}`}>{dayName}</span>
                                <div className="text-xs text-slate-400 font-mono">{dateStr.slice(5)}</div>
                            </div>
                            {!isEditing && (
                                <button 
                                    onClick={() => loadDayDetail(dateStr)}
                                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                                    title="查看详情与复盘"
                                >
                                    <BookOpen className="w-4 h-4"/>
                                </button>
                            )}
                        </div>
                        
                        <div className="space-y-2 flex-1">
                            {/* Task 1 */}
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                                {isEditing ? (
                                    <input 
                                        value={tasks[0]}
                                        onChange={(e) => updatePreset(dateStr, 0, e.target.value)}
                                        placeholder="主要任务 1..."
                                        className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-brand-500 outline-none"
                                    />
                                ) : (
                                    <span className={`text-sm truncate ${tasks[0] ? 'text-slate-700' : 'text-slate-300 italic'}`}>{tasks[0] || '空'}</span>
                                )}
                            </div>

                            {/* Task 2 */}
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                                {isEditing ? (
                                    <input 
                                        value={tasks[1]}
                                        onChange={(e) => updatePreset(dateStr, 1, e.target.value)}
                                        placeholder="主要任务 2..."
                                        className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-brand-500 outline-none"
                                    />
                                ) : (
                                    <span className={`text-sm truncate ${tasks[1] ? 'text-slate-700' : 'text-slate-300 italic'}`}>{tasks[1] || '空'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
            
            {/* Weekly Summary / Goal Card */}
            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col">
                <div className="flex items-center gap-2 mb-3 text-slate-500 font-bold">
                    <Target className="w-5 h-5" /> 本周目标 / 备注
                </div>
                {isEditing ? (
                    <textarea 
                         value={editedPlan.weeklySummary}
                         onChange={(e) => setEditedPlan({...editedPlan, weeklySummary: e.target.value})}
                         placeholder="本周的主要产出是什么？"
                         className="flex-1 w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                    />
                ) : (
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{plan.weeklySummary || "未设置具体目标。"}</p>
                )}
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
                          <div className="flex gap-2 text-xs text-slate-500 mt-1">
                              <span>任务: {selectedDayDetail.primaryTasks.filter(Boolean).join(' & ') || '无'}</span>
                          </div>
                      </div>
                      <button onClick={() => setSelectedDayDetail(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6">
                      
                      {/* Summary Section */}
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                          <h4 className="text-blue-900 font-bold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4"/> 每日总结</h4>
                          <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                              {selectedDayDetail.daySummary || <span className="text-slate-400 italic">未填写总结</span>}
                          </p>
                      </div>

                      {/* Check Log Section */}
                      <div>
                          <h4 className="text-slate-800 font-bold mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-brand-500"/> 过程检查记录 (Check Logs)</h4>
                          <div className="space-y-3">
                              {selectedDayDetail.timeBlocks.filter(b => b.check.comment || b.check.efficiency).length > 0 ? (
                                  selectedDayDetail.timeBlocks.filter(b => b.check.comment || b.check.efficiency).map(block => (
                                      <div key={block.id} className="flex gap-3 text-sm border-b border-slate-50 pb-2">
                                          <div className="font-mono text-slate-500 font-bold w-12">{block.time}</div>
                                          <div className="flex-1">
                                              <div className="text-slate-800">{block.check.comment}</div>
                                              {block.check.efficiency && (
                                                  <div className="text-xs text-slate-400 mt-1">效率评价: {block.check.efficiency}</div>
                                              )}
                                          </div>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-slate-400 text-sm italic text-center py-4">无检查记录</div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Visualization (Placeholder for now) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 opacity-60 pointer-events-none grayscale">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            承诺达成率 (开发中)
        </h3>
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Bar dataKey="planned" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="计划值" stackId="a" />
                    <Bar dataKey="completed" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="完成值" />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default WeeklyView;
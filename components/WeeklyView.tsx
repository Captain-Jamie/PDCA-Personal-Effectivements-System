import React, { useState, useEffect } from 'react';
import { WeeklyPlan } from '../types';
import { getWeeklyPlan, saveWeeklyPlan, getWeekId, getMondayOfWeek } from '../services/storage';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Calendar, Target, TrendingUp, ChevronLeft, ChevronRight, Edit3, Save, X } from 'lucide-react';

interface WeeklyViewProps {
  currentDate: Date;
}

const WeeklyView: React.FC<WeeklyViewProps> = ({ currentDate }) => {
  // Navigation State
  const [displayDate, setDisplayDate] = useState<Date>(new Date(currentDate));
  
  // Data State
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  
  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState<WeeklyPlan | null>(null);

  // Derived state
  const weekId = getWeekId(displayDate);
  const mondayDateStr = getMondayOfWeek(displayDate);

  // Load Plan when week changes
  useEffect(() => {
    const loadedPlan = getWeeklyPlan(weekId);
    
    // Ensure the plan has the correct start date if it's new
    if (!loadedPlan.startDate) {
        loadedPlan.startDate = mondayDateStr;
    }
    
    setPlan(loadedPlan);
    setEditedPlan(loadedPlan); // Initialize edit buffer
    setIsEditing(false);
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

  const handleSave = () => {
    if (editedPlan) {
        saveWeeklyPlan(editedPlan);
        setPlan(editedPlan);
        setIsEditing(false);
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

  if (!plan || !editedPlan) return <div className="p-8 text-center text-slate-500">Loading Plan...</div>;

  // Chart Mock Data (Visualization Only for MVP)
  const chartData = [
    { name: 'Mon', completed: 0, planned: 100 },
    { name: 'Tue', completed: 0, planned: 100 },
    { name: 'Wed', completed: 0, planned: 100 },
    { name: 'Thu', completed: 0, planned: 100 },
    { name: 'Fri', completed: 0, planned: 100 },
    { name: 'Sat', completed: 0, planned: 50 },
    { name: 'Sun', completed: 0, planned: 30 },
  ];

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Generate date objects for the current view week
  const weekDates: string[] = [];
  const start = new Date(mondayDateStr);
  for (let i = 0; i < 7; i++) {
     const d = new Date(start);
     d.setDate(start.getDate() + i);
     weekDates.push(d.toISOString().split('T')[0]);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-6">
        
        {/* Top Bar: Navigation and Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => handleWeekChange(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="text-center relative group cursor-pointer" title="Click to select a date to jump to">
                    <input 
                        type="date"
                        value={mondayDateStr}
                        onChange={handleDatePick}
                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                    />
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 justify-center group-hover:text-brand-600 transition-colors">
                        Week {weekId.split('-W')[1]} <span className="text-lg font-normal text-slate-400">({weekId.split('-W')[0]})</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1 group-hover:text-brand-400">{mondayDateStr} to {weekDates[6]}</p>
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
                        <Edit3 className="w-4 h-4" /> Edit Plan
                    </button>
                ) : (
                    <>
                        <button 
                            onClick={handleCancel}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                        >
                            <X className="w-4 h-4" /> Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors shadow-md"
                        >
                            <Save className="w-4 h-4" /> Save Plan
                        </button>
                    </>
                )}
            </div>
        </div>

        {/* Theme Section */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <span className="font-bold text-slate-700 whitespace-nowrap flex items-center gap-2">
                    <Target className="w-5 h-5 text-brand-500" /> Weekly Focus Theme:
                </span>
                {isEditing ? (
                    <input 
                        value={editedPlan.theme}
                        onChange={(e) => setEditedPlan({...editedPlan, theme: e.target.value})}
                        placeholder="e.g. Foundation Week, High Impact Week..."
                        className="flex-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                ) : (
                    <span className="text-lg text-slate-800 font-medium">{plan.theme || <span className="text-slate-400 italic">No theme set</span>}</span>
                )}
            </div>
        </div>
      </div>

      {/* 7-Day Planning Matrix */}
      <div>
         <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
             <Calendar className="w-5 h-5 text-brand-600" /> Daily Principal Tasks (Presets)
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
                            <span className={`font-bold ${isToday ? 'text-brand-800' : 'text-slate-700'}`}>{dayName}</span>
                            <span className="text-xs text-slate-400 font-mono">{dateStr.slice(5)}</span>
                        </div>
                        
                        <div className="space-y-2 flex-1">
                            {/* Task 1 */}
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                                {isEditing ? (
                                    <input 
                                        value={tasks[0]}
                                        onChange={(e) => updatePreset(dateStr, 0, e.target.value)}
                                        placeholder="Primary Task 1..."
                                        className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-brand-500 outline-none"
                                    />
                                ) : (
                                    <span className={`text-sm truncate ${tasks[0] ? 'text-slate-700' : 'text-slate-300 italic'}`}>{tasks[0] || 'Empty'}</span>
                                )}
                            </div>

                            {/* Task 2 */}
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                                {isEditing ? (
                                    <input 
                                        value={tasks[1]}
                                        onChange={(e) => updatePreset(dateStr, 1, e.target.value)}
                                        placeholder="Primary Task 2..."
                                        className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-brand-500 outline-none"
                                    />
                                ) : (
                                    <span className={`text-sm truncate ${tasks[1] ? 'text-slate-700' : 'text-slate-300 italic'}`}>{tasks[1] || 'Empty'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
            
            {/* Weekly Summary / Goal Card */}
            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col">
                <div className="flex items-center gap-2 mb-3 text-slate-500 font-bold">
                    <Target className="w-5 h-5" /> Weekly Goal
                </div>
                {isEditing ? (
                    <textarea 
                         value={editedPlan.weeklySummary}
                         onChange={(e) => setEditedPlan({...editedPlan, weeklySummary: e.target.value})}
                         placeholder="What is the main outcome for this week?"
                         className="flex-1 w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                    />
                ) : (
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{plan.weeklySummary || "No specific weekly goal set."}</p>
                )}
            </div>
         </div>
      </div>

      {/* Visualization (Placeholder for now) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 opacity-60 pointer-events-none grayscale">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            Commitment Fulfillment Rate (Coming Soon)
        </h3>
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Bar dataKey="planned" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Planned" stackId="a" />
                    <Bar dataKey="completed" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Completed" />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default WeeklyView;
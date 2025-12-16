import React, { useState, useEffect } from 'react';
import { ViewMode, DailyRecord } from './types';
import { getDailyRecord, saveDailyRecord } from './services/storage';
import DailyView from './components/DailyView';
import WeeklyView from './components/WeeklyView';
import DailyActModal from './components/DailyActModal';
import SettingsModal from './components/SettingsModal';
import { LayoutDashboard, CalendarDays, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [currentDateStr, setCurrentDateStr] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);
  const [isActModalOpen, setIsActModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Load data when date changes
    const record = getDailyRecord(currentDateStr);
    setDailyRecord(record);
  }, [currentDateStr]);

  const handleUpdateRecord = (updated: DailyRecord) => {
    setDailyRecord(updated);
    // Persist immediately managed in component or here, let's keep it here for safety
    saveDailyRecord(updated);
  };

  const handleDaySwitch = (direction: 'prev' | 'next') => {
    const d = new Date(currentDateStr);
    d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDateStr(d.toISOString().split('T')[0]);
  };

  const startNewDay = (nextDayPrimaryTasks: [string, string]) => {
     // Close modal
     setIsActModalOpen(false);
     
     // Calculate tomorrow's date
     const d = new Date(currentDateStr);
     d.setDate(d.getDate() + 1);
     const nextDateStr = d.toISOString().split('T')[0];

     // Pre-initialize tomorrow's record with the selected tasks
     const existingNext = getDailyRecord(nextDateStr);
     const updatedNext = {
         ...existingNext,
         primaryTasks: nextDayPrimaryTasks
     };
     saveDailyRecord(updatedNext);

     // Switch view to tomorrow
     setCurrentDateStr(nextDateStr);
     setDailyRecord(updatedNext);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 md:px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-brand-600 rounded-lg p-1.5">
               <LayoutDashboard className="w-5 h-5 text-white" />
             </div>
             <h1 className="font-bold text-xl tracking-tight hidden md:block">PDCA<span className="text-brand-600">Flow</span></h1>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
                onClick={() => setViewMode('daily')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'daily' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <LayoutDashboard className="w-4 h-4" /> Daily
             </button>
             <button 
                onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'weekly' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <CalendarDays className="w-4 h-4" /> Weekly
             </button>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
             {viewMode === 'daily' && (
                 <div className="flex items-center bg-white border border-slate-200 rounded-lg px-1 py-1 shadow-sm mr-2">
                    <button onClick={() => handleDaySwitch('prev')} className="p-1 hover:bg-slate-100 rounded text-slate-500 text-lg font-bold">‹</button>
                    <input 
                      type="date"
                      value={currentDateStr}
                      onChange={(e) => e.target.value && setCurrentDateStr(e.target.value)}
                      className="mx-1 text-sm font-mono font-medium text-slate-700 border-none outline-none bg-transparent p-0 w-[110px] text-center cursor-pointer hover:bg-slate-50 rounded"
                    />
                    <button onClick={() => handleDaySwitch('next')} className="p-1 hover:bg-slate-100 rounded text-slate-500 text-lg font-bold">›</button>
                 </div>
             )}
             
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                title="Bio Clock Settings"
             >
                <Settings className="w-5 h-5" />
             </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 pb-24">
         {viewMode === 'daily' && dailyRecord && (
            <div className="animate-fade-in">
              <DailyView 
                 record={dailyRecord} 
                 onUpdateRecord={handleUpdateRecord}
                 onOpenAct={() => setIsActModalOpen(true)}
              />
            </div>
         )}

         {viewMode === 'weekly' && (
            <WeeklyView currentDate={new Date(currentDateStr)} />
         )}
      </main>

      {/* Modals */}
      {dailyRecord && (
        <DailyActModal 
           isOpen={isActModalOpen} 
           onClose={() => setIsActModalOpen(false)}
           record={dailyRecord}
           onRecordUpdate={handleUpdateRecord}
           onConfirmDayEnd={startNewDay}
        />
      )}
      
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default App;
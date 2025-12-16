import React, { useState, useEffect } from 'react';
import { ViewMode, DailyRecord } from './types';
import { getDailyRecord, saveDailyRecord } from './services/storage';
import { supabase, isSupabaseConfigured, disconnectSupabaseConnection } from './src/supabaseClient';
import DailyView from './components/DailyView';
import WeeklyView from './components/WeeklyView';
import DailyActModal from './components/DailyActModal';
import SettingsModal from './components/SettingsModal';
import { Auth } from './components/Auth';
import { LayoutDashboard, CalendarDays, Settings, LogOut, Loader2, Cloud, ChevronLeft, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App Data State
  const [currentDateStr, setCurrentDateStr] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  
  // Modal States
  const [isActModalOpen, setIsActModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // 1. Auth Init
  useEffect(() => {
    if (!isSupabaseConfigured()) {
        setAuthLoading(false);
        return;
    }

    if (supabase) {
        (supabase.auth as any).getSession().then(({ data: { session } }: any) => {
            setSession(session);
            setAuthLoading(false);
        });

        const {
            data: { subscription },
        } = (supabase.auth as any).onAuthStateChange((_event: any, session: any) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }
  }, []);

  // 2. Data Loading (Async)
  useEffect(() => {
    const loadData = async () => {
        setDataLoading(true);
        try {
            const record = await getDailyRecord(currentDateStr);
            setDailyRecord(record);
        } catch (e) {
            console.error(e);
        } finally {
            setDataLoading(false);
        }
    };
    loadData();
  }, [currentDateStr, session]); // Reload when date OR session changes

  const handleUpdateRecord = async (updated: DailyRecord) => {
    setDailyRecord(updated);
    await saveDailyRecord(updated);
  };

  const handleDaySwitch = (direction: 'prev' | 'next') => {
    const d = new Date(currentDateStr);
    d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDateStr(d.toISOString().split('T')[0]);
  };

  const startNewDay = async (nextDayPrimaryTasks: [string, string]) => {
     setIsActModalOpen(false);
     
     const d = new Date(currentDateStr);
     d.setDate(d.getDate() + 1);
     const nextDateStr = d.toISOString().split('T')[0];

     // Use async fetch for the next day
     const existingNext = await getDailyRecord(nextDateStr);
     const updatedNext = {
         ...existingNext,
         primaryTasks: nextDayPrimaryTasks
     };
     await saveDailyRecord(updatedNext);

     setCurrentDateStr(nextDateStr);
     setDailyRecord(updatedNext);
  };

  const handleLogout = async () => {
      if(supabase) await (supabase.auth as any).signOut();
  };

  // -- Render Logic --

  if (authLoading) return <div className="h-screen flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2"/> 正在加载 PDCA Flow...</div>;

  // If Supabase is configured BUT no session, force Auth (Guard).
  if (isSupabaseConfigured() && !session && !showAuthModal) {
      return <Auth />;
  }

  // --- Components for Navigation ---
  
  const ControlsGroup = () => (
      <>
        {/* View Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
                onClick={() => setViewMode('daily')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'daily' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <LayoutDashboard className="w-4 h-4" /> 日
             </button>
             <button 
                onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'weekly' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <CalendarDays className="w-4 h-4" /> 周
             </button>
        </div>

        {/* Date Navigator */}
        {viewMode === 'daily' && (
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-1 py-1 shadow-sm">
                <button onClick={() => handleDaySwitch('prev')} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                    <ChevronLeft className="w-5 h-5"/>
                </button>
                <input 
                    type="date"
                    value={currentDateStr}
                    onChange={(e) => e.target.value && setCurrentDateStr(e.target.value)}
                    className="mx-1 text-sm font-mono font-medium text-slate-700 border-none outline-none bg-transparent p-0 w-[110px] text-center cursor-pointer hover:bg-slate-50 rounded"
                />
                <button onClick={() => handleDaySwitch('next')} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                    <ChevronRight className="w-5 h-5"/>
                </button>
            </div>
        )}
      </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* 1. Primary Header (Logo + Account) */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          <div className="flex items-center gap-2 md:gap-3">
             <div className="bg-brand-600 rounded-lg p-1.5">
               <LayoutDashboard className="w-5 h-5 text-white" />
             </div>
             <h1 className="font-bold text-lg md:text-xl tracking-tight">PDCA<span className="text-brand-600">Flow</span></h1>
          </div>

          {/* Desktop Controls (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-4">
               <ControlsGroup />
          </div>

          {/* User & Settings Actions */}
          <div className="flex items-center gap-2 md:gap-4">
             {isSupabaseConfigured() && (
                 session ? (
                    <button 
                        onClick={handleLogout}
                        className="p-2 hover:bg-red-50 hover:text-red-600 rounded-full text-slate-500 transition-colors"
                        title={`已登录: ${session.user.email}`}
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                 ) : (
                    <button onClick={() => setShowAuthModal(true)} className="text-sm font-bold text-brand-600 hover:underline">登录</button>
                 )
             )}

             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                title="生物钟设置"
             >
                <Settings className="w-5 h-5" />
             </button>
          </div>
        </div>
      </nav>

      {/* 2. Secondary Header (Mobile Only) - Controls */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 shadow-sm sticky top-[60px] z-30 flex justify-between items-center gap-2 overflow-x-auto">
          <ControlsGroup />
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 pb-24">
         {dataLoading ? (
             <div className="flex justify-center items-center h-64 text-slate-400">
                 <Loader2 className="w-8 h-8 animate-spin" />
             </div>
         ) : (
             <>
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
             </>
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

      {/* Auth Modal for Manual Login (Only shown if configured but not logged in) */}
      {showAuthModal && (
          <Auth onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};

export default App;
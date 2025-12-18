
'use client';

import React, { useState, useEffect } from 'react';
import { ViewMode, DailyRecord } from '../types';
import { getDailyRecord, saveDailyRecord } from '../lib/storage';
import { supabase } from '../lib/supabaseClient';
import DailyView from '../components/DailyView';
import WeeklyView from '../components/WeeklyView';
import DailyActModal from '../components/DailyActModal';
import SettingsModal from '../components/SettingsModal';
import { Auth } from '../components/Auth';
import { LayoutDashboard, CalendarDays, Settings, LogOut, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [record, setRecord] = useState<DailyRecord | null>(null);
  
  const [isActOpen, setIsActOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      getDailyRecord(currentDate).then(setRecord);
    }
  }, [currentDate, session]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center text-slate-400">
      <Loader2 className="animate-spin mr-2" /> 正在进入系统...
    </div>
  );

  if (!session) return <Auth />;

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b sticky top-0 z-40 px-4 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-brand-600 rounded-lg p-1.5"><LayoutDashboard className="w-5 h-5 text-white" /></div>
            <h1 className="font-bold text-xl">PDCA<span className="text-brand-600">Flow</span></h1>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('daily')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${viewMode === 'daily' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>日</button>
              <button onClick={() => setViewMode('weekly')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${viewMode === 'weekly' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>周</button>
            </div>
            
            {viewMode === 'daily' && (
              <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border">
                <button onClick={() => {
                  const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d.toISOString().split('T')[0]);
                }}><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
                <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} className="bg-transparent text-sm font-mono focus:outline-none"/>
                <button onClick={() => {
                  const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d.toISOString().split('T')[0]);
                }}><ChevronRight className="w-4 h-4 text-slate-400"/></button>
              </div>
            )}

            <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><Settings className="w-5 h-5" /></button>
            <button onClick={() => supabase.auth.signOut()} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6 pb-24">
        {viewMode === 'daily' && record && (
          <DailyView record={record} onUpdateRecord={setRecord} onOpenAct={() => setIsActOpen(true)} />
        )}
        {viewMode === 'weekly' && <WeeklyView currentDate={new Date(currentDate)} />}
      </main>

      {record && <DailyActModal isOpen={isActOpen} onClose={() => setIsActOpen(false)} record={record} onRecordUpdate={setRecord} onConfirmDayEnd={(tasks) => {
        const d = new Date(currentDate); d.setDate(d.getDate() + 1);
        setCurrentDate(d.toISOString().split('T')[0]);
        setIsActOpen(false);
      }} />}
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onResetToday={async () => {
        const r = await getDailyRecord(currentDate); setRecord(r);
      }} />
    </div>
  );
}

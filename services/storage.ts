import { DailyRecord, TaskItem, WeeklyPlan, TimeBlock, BioClockConfig } from '../types';
import { BIO_CLOCK_CONFIG as DEFAULT_BIO_CLOCK_CONFIG, TIME_SLOTS, INITIAL_TASK_POOL } from '../constants';
import { supabase } from '../src/supabaseClient';

const STORAGE_KEYS = {
  DAILY_RECORDS: 'pdca_daily_records',
  TASK_POOL: 'pdca_task_pool',
  WEEKLY_PLANS: 'pdca_weekly_plans',
  BIO_CLOCK: 'pdca_bio_clock',
};

// --- Helper Functions ---

export const getWeekId = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const weekNo = Math.ceil((((d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000) + 1) / 7);
  return `${year}-W${weekNo.toString().padStart(2, '0')}`;
};

export const getMondayOfWeek = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

// --- Async Data Services ---

// 1. Bio Clock
export const getBioClockConfig = async (): Promise<BioClockConfig> => {
  if (supabase) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (user) {
      const { data, error } = await supabase
        .from('user_settings')
        .select('data')
        .eq('key', 'bio_clock')
        .single();
      
      if (data) return data.data as BioClockConfig;
      if (!error) return DEFAULT_BIO_CLOCK_CONFIG; 
    }
  }
  
  // Fallback
  const stored = localStorage.getItem(STORAGE_KEYS.BIO_CLOCK);
  return stored ? JSON.parse(stored) : DEFAULT_BIO_CLOCK_CONFIG;
};

export const saveBioClockConfig = async (config: BioClockConfig) => {
  if (supabase) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (user) {
      await supabase.from('user_settings').upsert(
        { user_id: user.id, key: 'bio_clock', data: config },
        { onConflict: 'user_id, key' }
      );
      return;
    }
  }
  localStorage.setItem(STORAGE_KEYS.BIO_CLOCK, JSON.stringify(config));
};

// Helper for Bio Locked calculation (synchronous logic needed inside async function)
const calculateBioLocks = (time: string, config: BioClockConfig) => {
  const [h, m] = time.split(':').map(Number);
  const timeVal = h * 60 + m;

  for (const meal of config.meals) {
    const [mh, mm] = meal.time.split(':').map(Number);
    const mealStart = mh * 60 + mm;
    const mealEnd = mealStart + meal.duration;
    if (timeVal >= mealStart && timeVal < mealEnd) {
      return { locked: true, content: meal.name };
    }
  }

  const [sleepStart, sleepEnd] = config.sleepWindow;
  const [sh, sm] = sleepStart.split(':').map(Number);
  const [eh, em] = sleepEnd.split(':').map(Number);
  const sleepStartVal = sh * 60 + sm;
  const sleepEndVal = eh * 60 + em;

  if (sleepStartVal > sleepEndVal) {
    if (timeVal >= sleepStartVal || timeVal < sleepEndVal) return { locked: true, content: 'Sleep' };
  } else {
    if (timeVal >= sleepStartVal && timeVal < sleepEndVal) return { locked: true, content: 'Sleep' };
  }
  return { locked: false, content: '' };
};

// 2. Daily Record
const createEmptyDay = async (date: string): Promise<DailyRecord> => {
  const config = await getBioClockConfig();
  
  const timeBlocks: TimeBlock[] = TIME_SLOTS.map((time) => {
    const { locked, content } = calculateBioLocks(time, config);
    return {
      id: `${date}-${time}`,
      time,
      plan: { content: content, isPrimary: false, isBioLocked: locked },
      do: { status: 'none', actualContent: '' },
      check: { efficiency: null, tags: [], comment: '' },
    };
  });

  // Check Weekly Plan for presets
  const dateObj = new Date(date);
  const weekId = getWeekId(dateObj);
  const weeklyPlan = await getWeeklyPlan(weekId);
  
  let primaryTasks: [string, string] = ['', ''];
  if (weeklyPlan.dailyPresets && weeklyPlan.dailyPresets[date]) {
      primaryTasks = weeklyPlan.dailyPresets[date];
  }

  return {
    date,
    primaryTasks,
    daySummary: '',
    timeBlocks,
  };
};

export const getDailyRecord = async (date: string): Promise<DailyRecord> => {
  if (supabase) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (user) {
      const { data } = await supabase
        .from('daily_records')
        .select('data')
        .eq('date', date)
        .eq('user_id', user.id)
        .single();
      
      if (data) return data.data as DailyRecord;
      
      // If no record, create empty and save
      const newRecord = await createEmptyDay(date);
      await saveDailyRecord(newRecord);
      return newRecord;
    }
  }

  // Fallback
  const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
  const records: Record<string, DailyRecord> = stored ? JSON.parse(stored) : {};
  if (!records[date]) {
    records[date] = await createEmptyDay(date);
    saveDailyRecord(records[date]); // Sync save for local
  }
  return records[date];
};

export const saveDailyRecord = async (record: DailyRecord) => {
  if (supabase) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (user) {
      await supabase.from('daily_records').upsert(
        { user_id: user.id, date: record.date, data: record },
        { onConflict: 'user_id, date' }
      );
      return;
    }
  }

  // Fallback
  const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
  const records: Record<string, DailyRecord> = stored ? JSON.parse(stored) : {};
  records[record.date] = record;
  localStorage.setItem(STORAGE_KEYS.DAILY_RECORDS, JSON.stringify(records));
};

// 3. Task Pool
export const getTaskPool = async (): Promise<TaskItem[]> => {
  if (supabase) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (user) {
      const { data } = await supabase
        .from('user_settings')
        .select('data')
        .eq('key', 'task_pool')
        .single();
      
      if (data) return data.data as TaskItem[];
      return [...INITIAL_TASK_POOL]; // Or empty []
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.TASK_POOL);
  if (!stored) {
    localStorage.setItem(STORAGE_KEYS.TASK_POOL, JSON.stringify(INITIAL_TASK_POOL));
    return [...INITIAL_TASK_POOL];
  }
  return JSON.parse(stored);
};

export const saveTaskPool = async (pool: TaskItem[]) => {
  if (supabase) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (user) {
      await supabase.from('user_settings').upsert(
        { user_id: user.id, key: 'task_pool', data: pool },
        { onConflict: 'user_id, key' }
      );
      return;
    }
  }
  localStorage.setItem(STORAGE_KEYS.TASK_POOL, JSON.stringify(pool));
};

// 4. Weekly Plan
export const getWeeklyPlan = async (weekId: string): Promise<WeeklyPlan> => {
  if (supabase) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (user) {
      const { data } = await supabase
        .from('weekly_plans')
        .select('data')
        .eq('week_id', weekId)
        .eq('user_id', user.id)
        .single();
      
      if (data) return data.data as WeeklyPlan;

      // Return empty template if not found
      return {
          id: weekId,
          weekId: weekId,
          theme: '',
          startDate: '', 
          dailyPresets: {},
          weeklySummary: ''
      };
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.WEEKLY_PLANS);
  const plans: Record<string, WeeklyPlan> = stored ? JSON.parse(stored) : {};
  if (!plans[weekId]) {
    return {
        id: weekId,
        weekId: weekId,
        theme: '',
        startDate: '',
        dailyPresets: {},
        weeklySummary: ''
    };
  }
  return plans[weekId];
};

export const saveWeeklyPlan = async (plan: WeeklyPlan) => {
  if (supabase) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (user) {
      await supabase.from('weekly_plans').upsert(
        { user_id: user.id, week_id: plan.weekId, data: plan },
        { onConflict: 'user_id, week_id' }
      );
      return;
    }
  }
  const stored = localStorage.getItem(STORAGE_KEYS.WEEKLY_PLANS);
  const plans: Record<string, WeeklyPlan> = stored ? JSON.parse(stored) : {};
  plans[plan.weekId] = plan;
  localStorage.setItem(STORAGE_KEYS.WEEKLY_PLANS, JSON.stringify(plans));
};
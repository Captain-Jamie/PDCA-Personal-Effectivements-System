
import { DailyRecord, TaskItem, WeeklyPlan, TimeBlock, BioClockConfig, DayTemplate, ExecutionStatus } from '../types';
import { BIO_CLOCK_CONFIG as DEFAULT_BIO_CLOCK_CONFIG, TIME_SLOTS, INITIAL_TASK_POOL } from './constants';
import { supabase } from './supabaseClient';

const STORAGE_KEYS = {
  DAILY_RECORDS: 'pdca_daily_records',
  TASK_POOL: 'pdca_task_pool',
  WEEKLY_PLANS: 'pdca_weekly_plans',
  BIO_CLOCK: 'pdca_bio_clock',
  TEMPLATES: 'pdca_day_templates',
};

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

const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

// --- Optimized Bio Clock Logic ---

const calculateBioLocks = (time: string, config: BioClockConfig) => {
  const timeVal = timeToMinutes(time);
  
  for (const meal of config.meals) {
    const mealStart = timeToMinutes(meal.time);
    const mealEnd = mealStart + meal.duration;
    if (timeVal >= mealStart && timeVal < mealEnd) return { locked: true, content: meal.name };
  }

  const [sVal, eVal] = [timeToMinutes(config.sleepWindow[0]), timeToMinutes(config.sleepWindow[1])];
  if (sVal > eVal) {
    if (timeVal >= sVal || timeVal < eVal) return { locked: true, content: 'Sleep' };
  } else {
    if (timeVal >= sVal && timeVal < eVal) return { locked: true, content: 'Sleep' };
  }
  return { locked: false, content: '' };
};

export const applyBioClockToRecord = (record: DailyRecord, config: BioClockConfig): DailyRecord => {
    const wakeUpTime = config.sleepWindow[1];
    let blocks = [...record.timeBlocks];

    const wakeUpBlockId = `${record.date}-${wakeUpTime}-WAKEUP`;
    if (!blocks.find(b => b.id === wakeUpBlockId)) {
        blocks.push({
            id: wakeUpBlockId,
            time: wakeUpTime,
            plan: { content: '起床', isPrimary: false, isBioLocked: true, span: 1 },
            do: { status: 'none', actualContent: '', span: 1 },
            check: { efficiency: null, tags: [], comment: '' }
        });
    }

    blocks = blocks.filter(b => !(b.id.endsWith('-WAKEUP') && b.time !== wakeUpTime));

    blocks = blocks.map(b => {
        if (b.id.endsWith('-WAKEUP')) return b;
        const { locked, content } = calculateBioLocks(b.time, config);
        let newContent = b.plan.content;
        if (locked) newContent = content;
        else if (b.plan.isBioLocked && (b.plan.content === 'Sleep' || config.meals.some(m => m.name === b.plan.content))) newContent = '';
        
        return { ...b, plan: { ...b.plan, isBioLocked: locked, content: newContent } };
    });

    blocks.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time) || (a.id.endsWith('-WAKEUP') ? -1 : 1));
    return { ...record, timeBlocks: blocks };
};

// --- API Service Methods ---

export const getDailyRecord = async (date: string): Promise<DailyRecord> => {
  let record: DailyRecord | null = null;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('daily_records').select('data').eq('date', date).eq('user_id', user.id).single();
      if (data) record = data.data as DailyRecord;
    }
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
    const records = stored ? JSON.parse(stored) : {};
    record = records[date];
  }

  if (record) {
    return record.bioConfig ? applyBioClockToRecord(record, record.bioConfig) : record;
  }

  const config = await getBioClockConfig();
  // Fix: Explicitly type timeBlocks to ensure correctly inferred ExecutionStatus for status property
  const timeBlocks: TimeBlock[] = TIME_SLOTS.map(time => {
    const { locked, content } = calculateBioLocks(time, config);
    return {
      id: `${date}-${time}`,
      time,
      plan: { content, isPrimary: false, isBioLocked: locked, span: 1 },
      do: { status: 'none' as ExecutionStatus, actualContent: '', span: 1 },
      check: { efficiency: null, tags: [], comment: '' },
    };
  });

  const newRecord = applyBioClockToRecord({ date, primaryTasks: ['', ''], daySummary: '', timeBlocks, bioConfig: config }, config);
  await saveDailyRecord(newRecord);
  return newRecord;
};

export const saveDailyRecord = async (record: DailyRecord) => {
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('daily_records').upsert({ user_id: user.id, date: record.date, data: record });
    }
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
    const records = stored ? JSON.parse(stored) : {};
    records[record.date] = record;
    localStorage.setItem(STORAGE_KEYS.DAILY_RECORDS, JSON.stringify(records));
  }
};

export const getBioClockConfig = async (): Promise<BioClockConfig> => {
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('user_settings').select('data').eq('key', 'bio_clock').single();
      if (data) return data.data as BioClockConfig;
    }
  }
  const stored = localStorage.getItem(STORAGE_KEYS.BIO_CLOCK);
  return stored ? JSON.parse(stored) : DEFAULT_BIO_CLOCK_CONFIG;
};

export const saveBioClockConfig = async (config: BioClockConfig) => {
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_settings').upsert({ user_id: user.id, key: 'bio_clock', data: config });
    }
  }
  localStorage.setItem(STORAGE_KEYS.BIO_CLOCK, JSON.stringify(config));
};

export const updateFutureRecordsWithBioConfig = async (config: BioClockConfig) => {
    const today = new Date().toISOString().split('T')[0];
    let records: DailyRecord[] = [];
    if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
             const { data } = await supabase.from('daily_records').select('data').gte('date', today).eq('user_id', user.id);
             if (data) records = data.map(d => d.data);
        }
    } else {
        const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
        records = Object.values(stored ? JSON.parse(stored) : {}).filter((r: any) => r.date >= today) as DailyRecord[];
    }
    for (const r of records) {
        const updated = applyBioClockToRecord(r, config);
        updated.bioConfig = config;
        await saveDailyRecord(updated);
    }
};

export const getWeeklyPlan = async (weekId: string): Promise<WeeklyPlan> => {
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('weekly_plans').select('data').eq('week_id', weekId).eq('user_id', user.id).single();
      if (data) return data.data;
    }
  }
  const stored = localStorage.getItem(STORAGE_KEYS.WEEKLY_PLANS);
  const plans = stored ? JSON.parse(stored) : {};
  return plans[weekId] || { id: weekId, weekId, theme: '', startDate: '', dailyPresets: {}, weeklySummary: '' };
};

export const saveWeeklyPlan = async (plan: WeeklyPlan) => {
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('weekly_plans').upsert({ user_id: user.id, week_id: plan.weekId, data: plan });
    }
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.WEEKLY_PLANS);
    const plans = stored ? JSON.parse(stored) : {};
    plans[plan.weekId] = plan;
    localStorage.setItem(STORAGE_KEYS.WEEKLY_PLANS, JSON.stringify(plans));
  }
};

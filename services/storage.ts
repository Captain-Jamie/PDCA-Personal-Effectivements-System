import { DailyRecord, TaskItem, WeeklyPlan, TimeBlock, BioClockConfig, DayTemplate } from '../types';
import { BIO_CLOCK_CONFIG as DEFAULT_BIO_CLOCK_CONFIG, TIME_SLOTS, INITIAL_TASK_POOL } from '../constants';
import { supabase } from '../src/supabaseClient';

const STORAGE_KEYS = {
  DAILY_RECORDS: 'pdca_daily_records',
  TASK_POOL: 'pdca_task_pool',
  WEEKLY_PLANS: 'pdca_weekly_plans',
  BIO_CLOCK: 'pdca_bio_clock',
  TEMPLATES: 'pdca_day_templates',
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

// --- Export Helper ---
export const exportToCSV = (filename: string, rows: string[][]) => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + rows.map(e => e.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    // Sleep crosses midnight (e.g. 23:00 to 07:00)
    if (timeVal >= sleepStartVal || timeVal < sleepEndVal) return { locked: true, content: 'Sleep' };
  } else {
    // Standard (e.g. 01:00 to 06:00)
    if (timeVal >= sleepStartVal && timeVal < sleepEndVal) return { locked: true, content: 'Sleep' };
  }
  return { locked: false, content: '' };
};

// 2. Daily Record
export const createEmptyDay = async (date: string): Promise<DailyRecord> => {
  const config = await getBioClockConfig();
  
  const timeBlocks: TimeBlock[] = TIME_SLOTS.map((time) => {
    const { locked, content } = calculateBioLocks(time, config);
    return {
      id: `${date}-${time}`,
      time,
      plan: { content: content, isPrimary: false, isBioLocked: locked, span: 1 },
      do: { status: 'none', actualContent: '', span: 1 },
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

const ensureTimeBlocksCoverage = async (record: DailyRecord): Promise<DailyRecord> => {
    // Basic check: if the record has NO blocks (which shouldn't happen) or very few, we might need to fix.
    // But since the user wants manual deletion, we shouldn't force-add ALL slots back if they deleted them.
    // We only force-add if the record is completely empty or malformed from old version.
    // However, to respect "24h coverage" from previous requirement BUT allow manual delete,
    // we should only ensure coverage if it looks like an old legacy record (e.g. 7-23).
    // For now, let's assume if it has blocks, we trust the user's deletion choice.
    
    // Compatibility: Ensure `span` property exists
    let modified = false;
    const newBlocks = record.timeBlocks.map(b => {
        let newB = { ...b };
        if (typeof newB.plan.span === 'undefined') { newB.plan.span = 1; modified = true; }
        if (typeof newB.do.span === 'undefined') { newB.do.span = 1; modified = true; }
        return newB;
    });

    if (modified) {
        return { ...record, timeBlocks: newBlocks };
    }
    return record;
};

export const getDailyRecord = async (date: string): Promise<DailyRecord> => {
  let record: DailyRecord | null = null;
  
  if (supabase) {
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (user) {
      const { data } = await supabase
        .from('daily_records')
        .select('data')
        .eq('date', date)
        .eq('user_id', user.id)
        .single();
      
      if (data) record = data.data as DailyRecord;
    }
  } else {
    // Fallback
    const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
    const records: Record<string, DailyRecord> = stored ? JSON.parse(stored) : {};
    if (records[date]) record = records[date];
  }

  if (record) {
      const updatedRecord = await ensureTimeBlocksCoverage(record);
      // We don't auto-save here unless necessary to prevent overwrite loop
      return updatedRecord;
  }
  
  // If no record, create empty and save
  const newRecord = await createEmptyDay(date);
  await saveDailyRecord(newRecord);
  return newRecord;
};

export const resetDailyRecord = async (date: string): Promise<DailyRecord> => {
    // Re-create empty day (respects bio clock)
    const empty = await createEmptyDay(date);
    await saveDailyRecord(empty);
    return empty;
};

export const getDailyRecordsRange = async (startDate: string, endDate: string): Promise<DailyRecord[]> => {
    // Generate dates in range
    const dates: string[] = [];
    const d = new Date(startDate);
    const end = new Date(endDate);
    while (d <= end) {
        dates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
    }

    if (supabase) {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (user) {
            const { data } = await supabase
                .from('daily_records')
                .select('data')
                .in('date', dates)
                .eq('user_id', user.id);
            
            const fetchedRecords = (data || []).map((d: any) => d.data as DailyRecord);
            // Explicitly map by date using Map<string, DailyRecord> to ensure type safety
            const lookup = new Map<string, DailyRecord>();
            fetchedRecords.forEach(r => lookup.set(r.date, r));

            const results = [];
            for (const date of dates) {
                if(lookup.has(date)) results.push(await ensureTimeBlocksCoverage(lookup.get(date)!));
                else results.push(await createEmptyDay(date));
            }
            return results;
        }
    }

    // Fallback
    const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
    const records = (stored ? JSON.parse(stored) : {}) as Record<string, DailyRecord>;
    const results: DailyRecord[] = [];
    for (const date of dates) {
        if(records[date]) results.push(await ensureTimeBlocksCoverage(records[date]));
        else results.push(await createEmptyDay(date));
    }
    return results;
};

export const saveDailyRecord = async (record: DailyRecord) => {
  // Always ensure blocks are sorted by time before saving
  record.timeBlocks.sort((a, b) => {
      const [h1, m1] = a.time.split(':').map(Number);
      const [h2, m2] = b.time.split(':').map(Number);
      return (h1 * 60 + m1) - (h2 * 60 + m2);
  });

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

// 5. Day Templates
export const getDayTemplates = async (): Promise<DayTemplate[]> => {
    if (supabase) {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (user) {
            const { data } = await supabase
                .from('user_settings')
                .select('data')
                .eq('key', 'day_templates')
                .single();
            if (data) return data.data as DayTemplate[];
            return [];
        }
    }
    const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    return stored ? JSON.parse(stored) : [];
};

export const saveDayTemplate = async (template: DayTemplate) => {
    const templates = await getDayTemplates();
    // Add or Update
    const idx = templates.findIndex(t => t.id === template.id);
    let newTemplates;
    if (idx >= 0) {
        newTemplates = [...templates];
        newTemplates[idx] = template;
    } else {
        newTemplates = [...templates, template];
    }

    if (supabase) {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (user) {
            await supabase.from('user_settings').upsert(
                { user_id: user.id, key: 'day_templates', data: newTemplates },
                { onConflict: 'user_id, key' }
            );
            return;
        }
    }
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(newTemplates));
};
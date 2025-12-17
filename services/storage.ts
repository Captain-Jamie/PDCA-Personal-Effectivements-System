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

const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
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

/**
 * Updates the Bio Config for the CURRENT day's record (Today).
 * This allows "effective immediately" changes when user modifies settings,
 * without affecting historical records.
 */
export const updateTodayRecordWithBioConfig = async (config: BioClockConfig) => {
    const today = new Date().toISOString().split('T')[0];
    let record: DailyRecord | null = null;
    
    // Fetch today's raw record
    if (supabase) {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (user) {
            const { data } = await supabase.from('daily_records').select('data').eq('date', today).eq('user_id', user.id).single();
            if (data) record = data.data as DailyRecord;
        }
    } else {
        const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
        const records = stored ? JSON.parse(stored) : {};
        if (records[today]) record = records[today];
    }
    
    if (record) {
        // Apply new config logic to today's record
        const updated = applyBioClockToRecord(record, config);
        // Save the snapshot so future reads use this config
        updated.bioConfig = config; 
        await saveDailyRecord(updated);
    }
};

// Helper for Bio Locked calculation
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
    // Locked if >= 23:00 OR < 07:00. 
    // 07:00 itself is unlocked by this logic, which is correct (standard slot available).
    if (timeVal >= sleepStartVal || timeVal < sleepEndVal) return { locked: true, content: 'Sleep' };
  } else {
    // Standard (e.g. 01:00 to 06:00)
    if (timeVal >= sleepStartVal && timeVal < sleepEndVal) return { locked: true, content: 'Sleep' };
  }
  return { locked: false, content: '' };
};

/**
 * Ensures the daily record reflects the current BioClock configuration.
 * logic:
 * 1. Creates a distinct WAKEUP block.
 * 2. Cleans up standard blocks.
 * 3. Updates all Bio Locks.
 * 4. Sorts so WAKEUP appears first.
 */
const applyBioClockToRecord = (record: DailyRecord, config: BioClockConfig): DailyRecord => {
    const wakeUpTime = config.sleepWindow[1];
    let blocks = [...record.timeBlocks];

    // 1. Manage WAKEUP Block (Distinct ID)
    const wakeUpBlockId = `${record.date}-${wakeUpTime}-WAKEUP`;
    const existingWakeUp = blocks.find(b => b.id === wakeUpBlockId);

    if (existingWakeUp) {
        // Ensure it stays locked and has correct time/content
        blocks = blocks.map(b => b.id === wakeUpBlockId ? {
             ...b,
             time: wakeUpTime,
             plan: { ...b.plan, content: '起床', isBioLocked: true }
        } : b);
    } else {
        // Create new distinct block
        blocks.push({
            id: wakeUpBlockId,
            time: wakeUpTime,
            plan: { content: '起床', isPrimary: false, isBioLocked: true, span: 1 },
            do: { status: 'none', actualContent: '', span: 1 },
            check: { efficiency: null, tags: [], comment: '' }
        });
    }

    // 2. Cleanup Standard Blocks (Remove '起床' artifacts from standard slots)
    blocks = blocks.map(b => {
        if (b.id !== wakeUpBlockId && b.time === wakeUpTime) {
             // If plan content is exactly '起床' (legacy auto-fill), clear it
             if (b.plan.content === '起床') {
                  return { ...b, plan: { ...b.plan, content: '', isBioLocked: false } };
             }
             // If it starts with '起床 ' (legacy merge), remove prefix
             if (b.plan.content.startsWith('起床 ')) {
                  return { ...b, plan: { ...b.plan, content: b.plan.content.replace(/^起床\s*/, '') } };
             }
        }
        return b;
    });

    // 3. Remove stale WAKEUP blocks (if user changed bio clock time, e.g. from 07:00 to 06:00)
    blocks = blocks.filter(b => {
        if (b.id.endsWith('-WAKEUP') && b.time !== wakeUpTime) return false;
        return true;
    });

    // 4. Update Locks for Standard Blocks
    blocks = blocks.map(b => {
        if (b.id.endsWith('-WAKEUP')) return b; // Skip special block logic
        
        const { locked, content } = calculateBioLocks(b.time, config);
        
        let newContent = b.plan.content;
        if (locked) {
            // Apply system content (Sleep/Meals)
            newContent = content; 
        } else if (b.plan.isBioLocked && !locked) {
            // Unlocking: Clear system content if it matches known system strings
            if (b.plan.content === 'Sleep' || config.meals.some(m => m.name === b.plan.content)) {
                newContent = '';
            }
        }

        return {
            ...b,
            plan: { ...b.plan, isBioLocked: locked, content: newContent }
        };
    });

    // 5. Sort (Time asc, then WAKEUP block first)
    blocks.sort((a, b) => {
        const ta = timeToMinutes(a.time);
        const tb = timeToMinutes(b.time);
        if (ta !== tb) return ta - tb;
        
        // Same time: WAKEUP block comes first
        if (a.id.endsWith('-WAKEUP')) return -1;
        if (b.id.endsWith('-WAKEUP')) return 1;
        return 0;
    });

    // 6. Span cleanup (Legacy safety)
    blocks = blocks.map(b => ({
        ...b,
        plan: { ...b.plan, span: b.plan.span ?? 1 },
        do: { ...b.do, span: b.do.span ?? 1 }
    }));

    return { ...record, timeBlocks: blocks };
};

// 2. Daily Record
export const createEmptyDay = async (date: string): Promise<DailyRecord> => {
  const config = await getBioClockConfig();
  
  // Standard Slots
  const timeBlocks: TimeBlock[] = TIME_SLOTS.map((time) => {
    // Initial calculation
    const { locked, content } = calculateBioLocks(time, config);
    return {
      id: `${date}-${time}`,
      time,
      plan: { content: content, isPrimary: false, isBioLocked: locked, span: 1 },
      do: { status: 'none', actualContent: '', span: 1 },
      check: { efficiency: null, tags: [], comment: '' },
    };
  });

  // Apply Wake Up Logic immediately (Injects WAKEUP block)
  const rawRecord: DailyRecord = {
    date,
    primaryTasks: ['', ''],
    daySummary: '',
    timeBlocks,
    bioConfig: config // Save Snapshot of current config!
  };
  
  const recordWithWakeUp = applyBioClockToRecord(rawRecord, config);

  // Check Weekly Plan for presets
  const dateObj = new Date(date);
  const weekId = getWeekId(dateObj);
  const weeklyPlan = await getWeeklyPlan(weekId);
  
  if (weeklyPlan.dailyPresets && weeklyPlan.dailyPresets[date]) {
      recordWithWakeUp.primaryTasks = weeklyPlan.dailyPresets[date];
  }

  return recordWithWakeUp;
};

export const getDailyRecord = async (date: string): Promise<DailyRecord> => {
  let record: DailyRecord | null = null;
  // const config = await getBioClockConfig(); // Removed global config dependency for existing records
  
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
      // Historical Data Protection:
      // If the record has its own bioConfig snapshot, enforce it.
      if (record.bioConfig) {
           return applyBioClockToRecord(record, record.bioConfig);
      }
      // If no bioConfig (legacy record), return AS-IS to preserve history.
      // Do NOT apply the current global Bio Clock.
      return record;
  }
  
  // If no record, create empty and save (Uses current global config)
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
    // const config = await getBioClockConfig(); // Removed
    // Generate dates in range
    const dates: string[] = [];
    const d = new Date(startDate);
    const end = new Date(endDate);
    while (d <= end) {
        dates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
    }

    let results: DailyRecord[] = [];

    if (supabase) {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (user) {
            const { data } = await supabase
                .from('daily_records')
                .select('data')
                .in('date', dates)
                .eq('user_id', user.id);
            
            const fetchedRecords = (data || []).map((d: any) => d.data as DailyRecord);
            const lookup = new Map<string, DailyRecord>();
            fetchedRecords.forEach(r => lookup.set(r.date, r));

            for (const date of dates) {
                if(lookup.has(date)) results.push(lookup.get(date)!);
                else results.push(await createEmptyDay(date));
            }
        }
    } else {
        // Fallback
        const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
        const records = (stored ? JSON.parse(stored) : {}) as Record<string, DailyRecord>;
        for (const date of dates) {
            if(records[date]) results.push(records[date]);
            else results.push(await createEmptyDay(date));
        }
    }

    // Apply config sync ONLY if snapshot exists
    return results.map(r => {
        if (r.bioConfig) return applyBioClockToRecord(r, r.bioConfig);
        return r; // Return legacy as-is
    });
};

export const saveDailyRecord = async (record: DailyRecord) => {
  // Always ensure blocks are sorted by time before saving
  record.timeBlocks.sort((a, b) => {
      const ta = timeToMinutes(a.time);
      const tb = timeToMinutes(b.time);
      if (ta !== tb) return ta - tb;
      if (a.id.endsWith('-WAKEUP')) return -1;
      if (b.id.endsWith('-WAKEUP')) return 1;
      return 0;
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
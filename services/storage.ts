import { DailyRecord, TaskItem, WeeklyPlan, TimeBlock, PlanTrack, DoTrack, CheckTrack, BioClockConfig } from '../types';
import { BIO_CLOCK_CONFIG as DEFAULT_BIO_CLOCK_CONFIG, TIME_SLOTS, INITIAL_TASK_POOL } from '../constants';

const STORAGE_KEYS = {
  DAILY_RECORDS: 'pdca_daily_records',
  TASK_POOL: 'pdca_task_pool',
  WEEKLY_PLANS: 'pdca_weekly_plans',
  BIO_CLOCK: 'pdca_bio_clock',
};

// --- Helper Functions ---

// Get ISO Week ID (e.g., "2023-W43") from a date object
export const getWeekId = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const weekNo = Math.ceil((((d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000) + 1) / 7);
  return `${year}-W${weekNo.toString().padStart(2, '0')}`;
};

// Get the Monday date string of the week for a given date
export const getMondayOfWeek = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

// --- Bio Clock Services ---

export const getBioClockConfig = (): BioClockConfig => {
  const stored = localStorage.getItem(STORAGE_KEYS.BIO_CLOCK);
  return stored ? JSON.parse(stored) : DEFAULT_BIO_CLOCK_CONFIG;
};

export const saveBioClockConfig = (config: BioClockConfig) => {
  localStorage.setItem(STORAGE_KEYS.BIO_CLOCK, JSON.stringify(config));
};

// Helper to determine if a slot is bio-locked based on CURRENT config
const isBioLocked = (time: string, config: BioClockConfig): { locked: boolean; content: string } => {
  const [h, m] = time.split(':').map(Number);
  const timeVal = h * 60 + m;

  // Meal Checks
  for (const meal of config.meals) {
    const [mh, mm] = meal.time.split(':').map(Number);
    const mealStart = mh * 60 + mm;
    const mealEnd = mealStart + meal.duration;
    
    // Simple overlap check
    if (timeVal >= mealStart && timeVal < mealEnd) {
      return { locked: true, content: meal.name };
    }
  }

  // Sleep Check
  const [sleepStart, sleepEnd] = config.sleepWindow;
  const [sh, sm] = sleepStart.split(':').map(Number);
  const [eh, em] = sleepEnd.split(':').map(Number);
  
  const sleepStartVal = sh * 60 + sm;
  const sleepEndVal = eh * 60 + em;

  if (sleepStartVal > sleepEndVal) {
    if (timeVal >= sleepStartVal || timeVal < sleepEndVal) {
      return { locked: true, content: 'Sleep' };
    }
  } else {
    if (timeVal >= sleepStartVal && timeVal < sleepEndVal) {
       return { locked: true, content: 'Sleep' };
    }
  }

  return { locked: false, content: '' };
};

const createEmptyDay = (date: string): DailyRecord => {
  const config = getBioClockConfig();
  
  // 1. Generate Time Blocks
  const timeBlocks: TimeBlock[] = TIME_SLOTS.map((time) => {
    const { locked, content } = isBioLocked(time, config);
    return {
      id: `${date}-${time}`,
      time,
      plan: { content: content, isPrimary: false, isBioLocked: locked },
      do: { status: 'none', actualContent: '' },
      check: { efficiency: null, tags: [], comment: '' },
    };
  });

  // 2. Check Weekly Plan for presets (Principal Tasks)
  // We need to find the Week ID for this date
  const dateObj = new Date(date);
  const weekId = getWeekId(dateObj);
  const weeklyPlansStr = localStorage.getItem(STORAGE_KEYS.WEEKLY_PLANS);
  const weeklyPlans = weeklyPlansStr ? JSON.parse(weeklyPlansStr) : {};
  
  let primaryTasks: [string, string] = ['', ''];
  
  if (weeklyPlans[weekId]) {
    const plan = weeklyPlans[weekId] as WeeklyPlan;
    if (plan.dailyPresets && plan.dailyPresets[date]) {
        primaryTasks = plan.dailyPresets[date];
    }
  }

  return {
    date,
    primaryTasks, // Pre-filled from Weekly Plan if available
    daySummary: '',
    timeBlocks,
  };
};

export const getDailyRecord = (date: string): DailyRecord => {
  const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
  const records: Record<string, DailyRecord> = stored ? JSON.parse(stored) : {};
  
  if (!records[date]) {
    records[date] = createEmptyDay(date);
    saveDailyRecord(records[date]);
  }
  return records[date];
};

export const saveDailyRecord = (record: DailyRecord) => {
  const stored = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
  const records: Record<string, DailyRecord> = stored ? JSON.parse(stored) : {};
  records[record.date] = record;
  localStorage.setItem(STORAGE_KEYS.DAILY_RECORDS, JSON.stringify(records));
};

export const getTaskPool = (): TaskItem[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.TASK_POOL);
  if (!stored) {
    localStorage.setItem(STORAGE_KEYS.TASK_POOL, JSON.stringify(INITIAL_TASK_POOL));
    return [...INITIAL_TASK_POOL];
  }
  return JSON.parse(stored);
};

export const saveTaskPool = (pool: TaskItem[]) => {
  localStorage.setItem(STORAGE_KEYS.TASK_POOL, JSON.stringify(pool));
};

export const getWeeklyPlan = (weekId: string): WeeklyPlan => {
  const stored = localStorage.getItem(STORAGE_KEYS.WEEKLY_PLANS);
  const plans: Record<string, WeeklyPlan> = stored ? JSON.parse(stored) : {};
  
  if (!plans[weekId]) {
    // Return empty template for new weeks instead of demo data
    // We need to calculate start date based on weekId or context, 
    // but for simplicity in retrieval, we initialize with empty data.
    // The View component handles setting the correct startDate if it's missing.
    return {
        id: weekId,
        weekId: weekId,
        theme: '',
        startDate: '', // Will be filled by View
        dailyPresets: {},
        weeklySummary: ''
    };
  }
  return plans[weekId];
};

export const saveWeeklyPlan = (plan: WeeklyPlan) => {
  const stored = localStorage.getItem(STORAGE_KEYS.WEEKLY_PLANS);
  const plans: Record<string, WeeklyPlan> = stored ? JSON.parse(stored) : {};
  plans[plan.weekId] = plan;
  localStorage.setItem(STORAGE_KEYS.WEEKLY_PLANS, JSON.stringify(plans));
};
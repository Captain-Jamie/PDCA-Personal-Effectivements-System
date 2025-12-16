import { BioClockConfig, WeeklyPlan } from './types';

export const BIO_CLOCK_CONFIG: BioClockConfig = {
  sleepWindow: ["23:00", "07:00"],
  meals: [
    { name: "Lunch", time: "12:00", duration: 60 },
    { name: "Dinner", time: "18:00", duration: 60 }
  ]
};

// Generate time slots from 07:00 to 23:00 in 30 min intervals
export const TIME_SLOTS: string[] = [];
let hour = 7;
let min = 0;
while (hour < 23 || (hour === 23 && min === 0)) {
  const hStr = hour.toString().padStart(2, '0');
  const mStr = min.toString().padStart(2, '0');
  TIME_SLOTS.push(`${hStr}:${mStr}`);
  min += 30;
  if (min === 60) {
    min = 0;
    hour++;
  }
}

export const INITIAL_TASK_POOL = [
  { id: 't1', title: 'Complete project proposal', createdDate: '2023-10-24', source: 'manual', status: 'pending' },
  { id: 't2', title: 'Refactor auth module', createdDate: '2023-10-24', source: 'manual', status: 'pending' },
  { id: 't3', title: 'Call client regarding API', createdDate: '2023-10-24', source: 'weekly_preset', status: 'pending' },
  { id: 't4', title: 'Read technical documentation', createdDate: '2023-10-24', source: 'manual', status: 'pending' },
] as const;

export const INITIAL_WEEKLY_PLAN: WeeklyPlan = {
  id: '2023-W43',
  weekId: '2023-W43',
  theme: 'Foundation Week',
  startDate: '2023-10-23',
  dailyPresets: {
    '2023-10-23': ['Setup Repo', 'Team Meeting'],
    '2023-10-24': ['Database Schema', 'API Draft'],
    '2023-10-25': ['Frontend Skeleton', 'Auth UI'],
    '2023-10-26': ['Backend Core', 'Testing'],
    '2023-10-27': ['Integration', 'Demo Prep'],
    '2023-10-28': ['Review', 'Rest'],
    '2023-10-29': ['Planning', 'Family'],
  },
  weeklySummary: ''
};
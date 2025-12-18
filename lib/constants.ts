
import { BioClockConfig, WeeklyPlan } from '../types';

export const BIO_CLOCK_CONFIG: BioClockConfig = {
  sleepWindow: ["23:00", "07:00"],
  meals: [
    { name: "午餐", time: "12:00", duration: 60 },
    { name: "晚餐", time: "18:00", duration: 60 }
  ],
  enableSleepFold: true
};

export const TIME_SLOTS: string[] = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export const INITIAL_TASK_POOL = [
  { id: 't1', title: '完成项目提案书', createdDate: '2023-10-24', source: 'manual', status: 'pending' },
];

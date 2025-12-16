import { BioClockConfig, WeeklyPlan } from './types';

// 简单的邀请码，用于防止恶意注册
export const REGISTRATION_INVITE_CODE = "PDCA2025";

export const BIO_CLOCK_CONFIG: BioClockConfig = {
  sleepWindow: ["23:00", "07:00"],
  meals: [
    { name: "午餐", time: "12:00", duration: 60 },
    { name: "晚餐", time: "18:00", duration: 60 }
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
  { id: 't1', title: '完成项目提案书', createdDate: '2023-10-24', source: 'manual', status: 'pending' },
  { id: 't2', title: '重构认证模块', createdDate: '2023-10-24', source: 'manual', status: 'pending' },
  { id: 't3', title: '与客户沟通 API 接口', createdDate: '2023-10-24', source: 'weekly_preset', status: 'pending' },
  { id: 't4', title: '阅读技术文档', createdDate: '2023-10-24', source: 'manual', status: 'pending' },
] as const;

export const INITIAL_WEEKLY_PLAN: WeeklyPlan = {
  id: '2023-W43',
  weekId: '2023-W43',
  theme: '基础建设周',
  startDate: '2023-10-23',
  dailyPresets: {
    '2023-10-23': ['建立代码仓库', '团队会议'],
    '2023-10-24': ['数据库设计', 'API 草案'],
    '2023-10-25': ['前端脚手架', '认证 UI'],
    '2023-10-26': ['后端核心', '单元测试'],
    '2023-10-27': ['集成联调', '演示准备'],
    '2023-10-28': ['复盘回顾', '休息'],
    '2023-10-29': ['下周计划', '家庭时光'],
  },
  weeklySummary: ''
};
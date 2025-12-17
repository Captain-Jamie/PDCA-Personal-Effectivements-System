
// Data Models based on the provided specifications

// 1. Bio Clock Configuration
export interface BioClockConfig {
  sleepWindow: [string, string]; // e.g. ["23:00", "07:00"]
  meals: Array<{ name: string; time: string; duration: number }>; // duration in minutes
  enableSleepFold?: boolean; // New: Toggle to collapse sleep hours
}

// 2. Task Pool Item
export interface TaskItem {
  id: string;
  title: string;
  createdDate: string;
  source: 'manual' | 'carry_over' | 'weekly_preset';
  status: 'pending' | 'scheduled' | 'done';
}

// 3. Weekly Plan Data
export interface WeeklyPlan {
  id: string; // "YYYY-Www"
  weekId: string;
  theme: string;
  startDate: string; // ISO Date of Monday
  dailyPresets: Record<string, [string, string]>; // dateStr -> [TaskA, TaskB]
  weeklySummary: string;
}

// 4. Daily Record Core
export type EfficiencyRating = 'high' | 'normal' | 'low' | null;
export type ExecutionStatus = 'completed' | 'partial' | 'changed' | 'skipped' | 'none';

export interface PlanTrack {
  content: string;
  startTime?: string; // Optional: Specific start time (e.g., "10:15")
  endTime?: string;   // Optional: Specific end time
  isPrimary: boolean;
  isBioLocked: boolean; // Sleep or Meals
}

export interface DoTrack {
  status: ExecutionStatus;
  actualContent: string;
  startTime?: string;
  endTime?: string;
}

export interface CheckTrack {
  efficiency: EfficiencyRating;
  tags: string[]; // #Focus, #Interrupted
  comment: string;
}

export interface TimeBlock {
  id: string;
  time: string; // "09:00" - The anchor time of the slot
  plan: PlanTrack;
  do: DoTrack;
  check: CheckTrack;
}

export interface DailyRecord {
  date: string; // "YYYY-MM-DD"
  primaryTasks: [string, string];
  daySummary: string;
  timeBlocks: TimeBlock[];
}

// Helper types for UI
export type ViewMode = 'daily' | 'weekly' | 'act';
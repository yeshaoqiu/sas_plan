export type Subject = "writing" | "picture_composition" | "math" | "other";
export type TaskStatus = "pending" | "in_progress" | "done" | "scored";

export interface Child {
  id: number;
  name: string;
  grade: number;
  avatar: string;
  archived: number;
}

export interface TaskTemplate {
  id: number;
  name: string;
  subject: Subject;
  defaultMinutes: number;
  basePoints: number;
  archived: number;
}

export interface TaskInstance {
  id: number;
  childId: number;
  templateId: number;
  date: string;
  status: TaskStatus;
  actualMinutes: number | null;
  focused: number | null;     // 0/1
  usedScaffold: number | null; // 0/1
  didCheck: number | null;     // 0/1
  errorCount: number | null;
  note: string | null;
  pointsAwarded: number | null;
  startedAt: string | null;
  completedAt: string | null;
  scoredAt: string | null;
  bonusItemIds: number[];
}

export interface PointEntry {
  id: number;
  childId: number;
  delta: number;
  reason: string;
  taskInstanceId: number | null;
  rewardId: number | null;
  createdAt: string;
}

export interface Reward {
  id: number;
  name: string;
  cost: number;
  active: number; // 0/1
}

export interface BonusItem {
  id: number;
  name: string;
  description: string;
  points: number;
  active: number;
  sortOrder: number;
}

export interface ScoringSettings {
  onTimeBonus: number;
  errorPenalty: number;
  minPoints: number;
}

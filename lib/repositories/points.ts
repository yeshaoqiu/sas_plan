import type Database from "better-sqlite3";
import type { PointEntry } from "@/lib/types";

interface Row {
  id: number;
  child_id: number;
  delta: number;
  reason: string;
  task_instance_id: number | null;
  reward_id: number | null;
  created_at: string;
}

function toEntry(r: Row): PointEntry {
  return {
    id: r.id,
    childId: r.child_id,
    delta: r.delta,
    reason: r.reason,
    taskInstanceId: r.task_instance_id,
    rewardId: r.reward_id,
    createdAt: r.created_at,
  };
}

export function addPointEntry(
  db: Database.Database,
  input: {
    childId: number;
    delta: number;
    reason: string;
    taskInstanceId?: number | null;
    rewardId?: number | null;
    now?: string;
  },
): PointEntry {
  const createdAt = input.now ?? new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO point_entries (child_id, delta, reason, task_instance_id, reward_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.childId,
      input.delta,
      input.reason,
      input.taskInstanceId ?? null,
      input.rewardId ?? null,
      createdAt,
    );
  const r = db
    .prepare("SELECT * FROM point_entries WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as Row;
  return toEntry(r);
}

export function getBalance(db: Database.Database, childId: number): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(delta), 0) AS bal FROM point_entries WHERE child_id = ?")
    .get(childId) as { bal: number };
  return row.bal;
}

export function listEntries(db: Database.Database, childId: number): PointEntry[] {
  const rows = db
    .prepare("SELECT * FROM point_entries WHERE child_id = ? ORDER BY id DESC")
    .all(childId) as Row[];
  return rows.map(toEntry);
}

export function listRedemptions(
  db: Database.Database,
  childId: number,
): PointEntry[] {
  const rows = db
    .prepare(
      "SELECT * FROM point_entries WHERE child_id = ? AND reward_id IS NOT NULL ORDER BY id DESC",
    )
    .all(childId) as Row[];
  return rows.map(toEntry);
}

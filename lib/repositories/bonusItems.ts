import type { DB } from "@/lib/sqlite-compat";
import type { BonusItem } from "@/lib/types";

interface Row {
  id: number;
  name: string;
  description: string;
  points: number;
  active: number;
  sort_order: number;
}

function toItem(r: Row): BonusItem {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    points: r.points,
    active: r.active,
    sortOrder: r.sort_order,
  };
}

export function getBonusItem(db: DB, id: number): BonusItem | undefined {
  const r = db.prepare("SELECT * FROM bonus_items WHERE id = ?").get(id) as Row | undefined;
  return r ? toItem(r) : undefined;
}

export function listBonusItems(db: DB): BonusItem[] {
  const rows = db
    .prepare("SELECT * FROM bonus_items WHERE active = 1 ORDER BY sort_order, id")
    .all() as Row[];
  return rows.map(toItem);
}

export function listAllBonusItems(db: DB): BonusItem[] {
  const rows = db
    .prepare("SELECT * FROM bonus_items ORDER BY active DESC, sort_order, id")
    .all() as Row[];
  return rows.map(toItem);
}

export function createBonusItem(
  db: DB,
  input: { name: string; description?: string; points: number; sortOrder?: number },
): BonusItem {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("请填写加分项名称");
  const info = db
    .prepare(
      "INSERT INTO bonus_items (name, description, points, active, sort_order) VALUES (?, ?, ?, 1, ?)",
    )
    .run(name, input.description ?? "", input.points, input.sortOrder ?? 0);
  return getBonusItem(db, Number(info.lastInsertRowid))!;
}

export function updateBonusItem(
  db: DB,
  id: number,
  input: { name: string; description: string; points: number; sortOrder: number },
): BonusItem {
  db.prepare(
    "UPDATE bonus_items SET name = ?, description = ?, points = ?, sort_order = ? WHERE id = ?",
  ).run(input.name, input.description, input.points, input.sortOrder, id);
  return getBonusItem(db, id)!;
}

export function archiveBonusItem(db: DB, id: number): void {
  db.prepare("UPDATE bonus_items SET active = 0 WHERE id = ?").run(id);
}

export function restoreBonusItem(db: DB, id: number): void {
  db.prepare("UPDATE bonus_items SET active = 1 WHERE id = ?").run(id);
}

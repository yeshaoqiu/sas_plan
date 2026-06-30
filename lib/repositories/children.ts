import type Database from "better-sqlite3";
import type { Child } from "@/lib/types";

export function createChild(
  db: Database.Database,
  input: { name: string; grade: number; avatar?: string },
): Child {
  const info = db
    .prepare("INSERT INTO children (name, grade, avatar) VALUES (?, ?, ?)")
    .run(input.name, input.grade, input.avatar ?? "🐣");
  return getChild(db, Number(info.lastInsertRowid))!;
}

export function updateChild(
  db: Database.Database,
  id: number,
  input: { name: string; grade: number; avatar: string },
): Child {
  db.prepare("UPDATE children SET name = ?, grade = ?, avatar = ? WHERE id = ?")
    .run(input.name, input.grade, input.avatar, id);
  return getChild(db, id)!;
}

export function archiveChild(db: Database.Database, id: number): void {
  db.prepare("UPDATE children SET archived = 1 WHERE id = ?").run(id);
}

export function restoreChild(db: Database.Database, id: number): void {
  db.prepare("UPDATE children SET archived = 0 WHERE id = ?").run(id);
}

export function listChildren(db: Database.Database): Child[] {
  return db
    .prepare("SELECT * FROM children WHERE archived = 0 ORDER BY id")
    .all() as Child[];
}

export function listAllChildren(db: Database.Database): Child[] {
  return db
    .prepare("SELECT * FROM children ORDER BY archived, id")
    .all() as Child[];
}

export function getChild(db: Database.Database, id: number): Child | undefined {
  return db.prepare("SELECT * FROM children WHERE id = ?").get(id) as
    | Child
    | undefined;
}

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

export function listChildren(db: Database.Database): Child[] {
  return db.prepare("SELECT * FROM children ORDER BY id").all() as Child[];
}

export function getChild(db: Database.Database, id: number): Child | undefined {
  return db.prepare("SELECT * FROM children WHERE id = ?").get(id) as
    | Child
    | undefined;
}

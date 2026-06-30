import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function hasColumn(
  db: Database.Database,
  table: string,
  column: string,
): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return cols.some((c) => c.name === column);
}

function hasTable(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table);
  return row !== undefined;
}

export function runMigrations(db: Database.Database): void {
  if (!hasColumn(db, "children", "archived")) {
    db.exec("ALTER TABLE children ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn(db, "task_templates", "archived")) {
    db.exec("ALTER TABLE task_templates ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
  if (hasTable(db, "task_instances")) {
    if (!hasColumn(db, "task_instances", "started_at")) {
      db.exec("ALTER TABLE task_instances ADD COLUMN started_at TEXT");
    }
    if (!hasColumn(db, "task_instances", "completed_at")) {
      db.exec("ALTER TABLE task_instances ADD COLUMN completed_at TEXT");
    }
    if (!hasColumn(db, "task_instances", "scored_at")) {
      db.exec("ALTER TABLE task_instances ADD COLUMN scored_at TEXT");
    }
  }
}

export function createDb(filename: string): Database.Database {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "schema.sql"),
    "utf8",
  );
  db.exec(schema);
  runMigrations(db);
  return db;
}

let _db: Database.Database | null = null;
export function getDb(): Database.Database {
  if (!_db) _db = createDb(process.env.DB_PATH ?? "data/app.db");
  return _db;
}

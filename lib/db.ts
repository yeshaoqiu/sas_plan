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

export function seedDefaults(db: Database.Database): void {
  const bonusCount = (
    db.prepare("SELECT COUNT(*) AS n FROM bonus_items").get() as { n: number }
  ).n;
  if (bonusCount === 0) {
    const ins = db.prepare(
      "INSERT INTO bonus_items (name, description, points, active, sort_order) VALUES (?, ?, ?, 1, ?)",
    );
    ins.run("专注完成", "这次做题没分心、专注做完（尤其写字）。", 5, 0);
    ins.run("用上支架", "看图写话用上了结构支架（谁/在哪/做什么/怎么样/心情）。", 5, 1);
    ins.run("做了检查", "做完后做了复核/检查这一步。", 5, 2);
  }
  const hasSettings = db.prepare("SELECT 1 FROM scoring_settings WHERE id = 1").get();
  if (!hasSettings) {
    db.prepare(
      "INSERT INTO scoring_settings (id, on_time_bonus, error_penalty, min_points) VALUES (1, 3, 2, 1)",
    ).run();
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
  seedDefaults(db);
  return db;
}

let _db: Database.Database | null = null;
export function getDb(): Database.Database {
  if (!_db) _db = createDb(process.env.DB_PATH ?? "data/app.db");
  return _db;
}

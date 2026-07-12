import { openDatabase, type DB } from "./sqlite-compat";
import fs from "node:fs";
import path from "node:path";

export function hasColumn(db: DB, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return cols.some((c) => c.name === column);
}

function hasTable(db: DB, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table);
  return row !== undefined;
}

function getSchemaVersion(db: DB): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version ?? 0;
}

function setSchemaVersion(db: DB, v: number): void {
  db.exec(`PRAGMA user_version = ${v}`);
}

// 版本化迁移。每条 up 必须幂等（可重复执行不报错），以兼容早期用 hasColumn
// 探测方式升级过的老库。新增结构变更时，往数组追加一条 { version: N, up } 即可。
const MIGRATIONS: { version: number; up: (db: DB) => void }[] = [
  {
    version: 1,
    up: (db) => {
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
    },
  },
  {
    version: 2,
    up: (db) => {
      if (!hasColumn(db, "children", "wish_reward_id")) {
        db.exec("ALTER TABLE children ADD COLUMN wish_reward_id INTEGER REFERENCES rewards(id)");
      }
    },
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

export function runMigrations(db: DB): void {
  const current = getSchemaVersion(db);
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      m.up(db);
      setSchemaVersion(db, m.version);
    }
  }
}

export function seedDefaults(db: DB): void {
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

const MAX_BACKUPS = 10;

// 迁移前把当前库快照到 backups/，保留最近 MAX_BACKUPS 份。
// 万一某次升级/迁移出问题，可直接用备份覆盖 app.db 回滚。
function backupBeforeMigrate(filename: string): void {
  try {
    const dir = path.dirname(filename);
    const backupsDir = path.join(dir, "backups");
    fs.mkdirSync(backupsDir, { recursive: true });
    const d = new Date();
    const stamp =
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}` +
      `-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
    const base = path.basename(filename);
    fs.copyFileSync(filename, path.join(backupsDir, `${base}.${stamp}.bak`));

    const backups = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith(base) && f.endsWith(".bak"))
      .sort();
    for (const old of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
      fs.rmSync(path.join(backupsDir, old), { force: true });
    }
  } catch (e) {
    console.error("backup failed (continuing):", (e as Error).message);
  }
}

export function createDb(filename: string): DB {
  const isFile = filename !== ":memory:";
  if (isFile) fs.mkdirSync(path.dirname(filename), { recursive: true });

  const fileExisted = isFile && fs.existsSync(filename);
  const db = openDatabase(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // 把 WAL 合并进主库，确保后续备份是完整快照
  if (fileExisted) db.pragma("wal_checkpoint(TRUNCATE)");

  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "schema.sql"),
    "utf8",
  );
  db.exec(schema);

  // 仅当已有数据的旧库、且存在待执行迁移时，才在迁移前备份
  if (isFile && fileExisted && getSchemaVersion(db) < LATEST_SCHEMA_VERSION) {
    backupBeforeMigrate(filename);
  }

  runMigrations(db);
  seedDefaults(db);
  return db;
}

let _db: DB | null = null;
export function getDb(): DB {
  if (!_db) _db = createDb(process.env.DB_PATH ?? "data/app.db");
  return _db;
}

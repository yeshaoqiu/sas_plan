import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

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
  return db;
}

let _db: Database.Database | null = null;
export function getDb(): Database.Database {
  if (!_db) _db = createDb(process.env.DB_PATH ?? "data/app.db");
  return _db;
}

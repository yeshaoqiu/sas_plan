import { DatabaseSync, type StatementSync } from "node:sqlite";

// 让 node:sqlite 暴露出与 better-sqlite3 相同的最小接口，
// 这样各 repository 无需改动即可在 Termux/安卓（Node 24 内置 sqlite，免编译）上运行。

export interface Stmt {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export interface DB {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
  pragma(source: string): void;
  transaction<T>(fn: () => T): () => T;
  close(): void;
}

function wrapStmt(stmt: StatementSync): Stmt {
  return {
    get: (...params) => stmt.get(...(params as never[])) as unknown,
    all: (...params) => stmt.all(...(params as never[])) as unknown[],
    run: (...params) => {
      const r = stmt.run(...(params as never[]));
      return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
    },
  };
}

export function openDatabase(filename: string): DB {
  const inner = new DatabaseSync(filename);
  return {
    prepare: (sql) => wrapStmt(inner.prepare(sql)),
    exec: (sql) => inner.exec(sql),
    // better-sqlite3 的 db.pragma("journal_mode = WAL") 等价于 PRAGMA 语句
    pragma: (source) => inner.exec(`PRAGMA ${source}`),
    // 用 BEGIN/COMMIT/ROLLBACK 复刻 better-sqlite3 的 transaction 包装
    transaction: <T>(fn: () => T) => () => {
      inner.exec("BEGIN");
      try {
        const result = fn();
        inner.exec("COMMIT");
        return result;
      } catch (e) {
        inner.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => inner.close(),
  };
}

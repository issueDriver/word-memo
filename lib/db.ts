import "server-only";

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { AdminUser, Book } from "@/lib/types";

let database: DatabaseSync | undefined;

export function getDb() {
  if (database) return database;
  const directory = path.join(process.cwd(), ".data");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(directory, "word-memo.sqlite"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      lastLogin TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expiresAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_attempts (
      email TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      category TEXT NOT NULL,
      wordCount INTEGER NOT NULL,
      status TEXT NOT NULL,
      color TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY);
  `);
  // Seed once so deleting all books does not restore the examples on restart.
  if (
    !db.prepare("SELECT id FROM migrations WHERE id = 'sample-books'").get()
  ) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const insert = db.prepare(
        "INSERT INTO books VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      const examples = [
        [
          "大学英语四级核心词汇",
          "CET-4",
          "大学英语",
          2600,
          "published",
          "green",
        ],
        [
          "大学英语六级进阶词汇",
          "CET-6",
          "大学英语",
          3800,
          "published",
          "blue",
        ],
        ["雅思核心词汇", "IELTS", "出国考试", 4500, "published", "rose"],
        ["托福高频词汇", "TOEFL", "出国考试", 5200, "published", "violet"],
        [
          "考研英语必备词汇",
          "POSTGRADUATE",
          "大学英语",
          5500,
          "published",
          "amber",
        ],
        ["商务英语实用词汇", "BUSINESS", "职业英语", 1800, "draft", "teal"],
        ["日常英语 1000 词", "EVERYDAY", "基础英语", 1000, "published", "blue"],
        ["GRE 精选词汇", "GRE", "出国考试", 6500, "draft", "green"],
      ];
      for (const [index, book] of examples.entries()) {
        insert.run(`sample-${index + 1}`, ...book, new Date().toISOString());
      }
      db.prepare("INSERT INTO migrations VALUES ('sample-books')").run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  database = db;
  return db;
}

export const userColumns = "id, name, email, status, createdAt, lastLogin";

export function findUser(id: string) {
  const row = getDb()
    .prepare(`SELECT ${userColumns} FROM users WHERE id = ?`)
    .get(id) as AdminUser | undefined;
  return row ? { ...row } : undefined;
}

export function listUsers() {
  const rows = getDb()
    .prepare(`SELECT ${userColumns} FROM users ORDER BY createdAt DESC`)
    .all() as AdminUser[];
  return rows.map((row) => ({ ...row }));
}

export function listBooks() {
  const rows = getDb()
    .prepare("SELECT * FROM books ORDER BY updatedAt DESC, id ASC")
    .all() as Book[];
  return rows.map((row) => ({ ...row }));
}

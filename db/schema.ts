import { relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdminRole } from "@/lib/types";

export const adminUsers = pgTable(
  "admin-users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 40 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<AdminRole>().notNull().default("admin"),
    status: text("status")
      .$type<"active" | "disabled">()
      .notNull()
      .default("active"),
    loginAttempts: integer("login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    lastLogin: timestamp("last_login", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("admin_users_email_unique").on(sql`lower(${table.email})`),
    check(
      "admin_users_role_check",
      sql`${table.role} in ('system_admin', 'admin')`,
    ),
    check(
      "admin_users_status_check",
      sql`${table.status} in ('active', 'disabled')`,
    ),
    check("admin_users_login_attempts_check", sql`${table.loginAttempts} >= 0`),
  ],
).enableRLS();

export const books = pgTable(
  "books",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    wordCount: integer("wordCount").notNull().default(0),
    coverUrl: text("coverUrl").notNull(),
    bookId: text("bookId").notNull().unique(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text("status")
      .$type<"published" | "draft">()
      .notNull()
      .default("draft"),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("books_word_count_check", sql`${table.wordCount} >= 0`),
    check("books_status_check", sql`${table.status} in ('published', 'draft')`),
  ],
).enableRLS();

export const words = pgTable(
  "words",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedByDefaultAsIdentity(),
    wordRank: integer("wordRank"),
    headWord: text("headWord"),
    content: json("content").$type<unknown | null>(),
    bookId: text("bookId").references(() => books.bookId, {
      onUpdate: "cascade",
      onDelete: "restrict",
    }),
  },
  (table) => [
    index("words_book_id_idx").on(table.bookId),
    uniqueIndex("words_book_rank_unique").on(table.bookId, table.wordRank),
  ],
).enableRLS();

export const booksRelations = relations(books, ({ many }) => ({
  words: many(words),
}));

export const wordsRelations = relations(words, ({ one }) => ({
  book: one(books, { fields: [words.bookId], references: [books.bookId] }),
}));

export const adminSessions = pgTable(
  "admin-session",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_session_user_idx").on(table.userId),
    index("admin_session_expires_idx").on(table.expiresAt),
  ],
).enableRLS();

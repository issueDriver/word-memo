export type AdminUser = {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  createdAt: string;
  lastLogin: string | null;
};

export const categories = [
  "大学英语",
  "出国考试",
  "职业英语",
  "基础英语",
] as const;
export const coverColors = [
  "green",
  "blue",
  "rose",
  "violet",
  "amber",
  "teal",
] as const;

export type Book = {
  id: string;
  name: string;
  subtitle: string;
  category: (typeof categories)[number];
  wordCount: number;
  status: "published" | "draft";
  color: (typeof coverColors)[number];
  updatedAt: string;
};

export type ActionResult = { error?: string; success?: boolean };

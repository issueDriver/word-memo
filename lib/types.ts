export const adminRoles = ["system_admin", "admin"] as const;
export type AdminRole = (typeof adminRoles)[number];
export const adminRoleLabels: Record<AdminRole, string> = {
  system_admin: "系统管理员",
  admin: "普通管理员",
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "active" | "disabled";
  createdAt: string;
  lastLogin: string | null;
};

export type Book = {
  id: string;
  title: string;
  wordCount: number;
  coverUrl: string;
  bookId: string;
  tags: string[];
  status: "published" | "draft";
  updatedAt: string;
};

export type ActionResult = { error?: string; success?: boolean };

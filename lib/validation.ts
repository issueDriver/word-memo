import { z } from "zod";
import { adminRoles } from "@/lib/types";

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入姓名")
    .max(40, "姓名不能超过 40 个字符"),
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email("请输入有效的邮箱地址"))
    .transform((value) => value.toLowerCase()),
});

export const passwordSchema = z
  .string()
  .min(8, "密码至少需要 8 个字符")
  .max(128, "密码不能超过 128 个字符");

export const signupSchema = profileSchema
  .extend({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export const signinSchema = z.object({
  email: profileSchema.shape.email,
  password: z.string().min(1, "请输入密码").max(128),
});

export const adminProfileSchema = profileSchema.extend({
  role: z.enum(adminRoles, { error: "请选择管理员角色" }),
});
export const adminCreateSchema = signupSchema.safeExtend({
  role: adminProfileSchema.shape.role,
});

export const bookSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "请输入标题")
    .max(120, "标题不能超过 120 个字符"),
  wordCount: z
    .string()
    .trim()
    .min(1, "请输入单词数量")
    .pipe(
      z.coerce
        .number<string>({ error: "请输入单词数量" })
        .int("词数必须为整数")
        .min(0, "词数不能小于 0")
        .max(2147483647, "词数超出允许范围"),
    ),
  coverUrl: z
    .string()
    .trim()
    .max(2048, "封面 URL 不能超过 2048 个字符")
    .pipe(
      z.url({
        protocol: /^https?$/,
        error: "请输入有效的 HTTP 或 HTTPS 封面 URL",
      }),
    ),
  bookId: z
    .string()
    .trim()
    .min(1, "请输入 bookId")
    .max(120, "bookId 不能超过 120 个字符"),
  tags: z
    .string()
    .max(2000, "标签内容过长")
    .transform((value) => [
      ...new Set(
        value
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ])
    .pipe(
      z
        .array(z.string().max(40, "每个标签不能超过 40 个字符"))
        .max(20, "最多可设置 20 个标签"),
    ),
});

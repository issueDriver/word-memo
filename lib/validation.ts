import { z } from "zod";
import { categories, coverColors } from "@/lib/types";

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入姓名")
    .max(40, "姓名不能超过 40 个字符"),
  email: z
    .email("请输入有效的邮箱地址")
    .max(254)
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

export const bookSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入单词书名称")
    .max(60, "名称不能超过 60 个字符"),
  subtitle: z
    .string()
    .trim()
    .min(1, "请输入封面英文标题")
    .max(24, "封面标题不能超过 24 个字符"),
  category: z.enum(categories, { error: "请选择分类" }),
  wordCount: z.coerce
    .number()
    .int("词数必须为整数")
    .min(0, "词数不能小于 0")
    .max(100000, "词数不能超过 100,000"),
  status: z.enum(["published", "draft"]),
  color: z.enum(coverColors),
});

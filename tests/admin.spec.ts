import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const runId = `e2e-${Date.now()}`;
const email = `${runId}@example.com`;
const teammateEmail = `${runId}-team@example.com`;
const mobileEmail = `${runId}-mobile@example.com`;
const password = "WordMemo-2026!";
const bookName = `${runId} 测试单词书`;

test.afterAll(() => {
  const db = new DatabaseSync(
    path.join(process.cwd(), ".data/word-memo.sqlite"),
  );
  if (
    !db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
      )
      .get()
  ) {
    db.close();
    return;
  }
  db.exec("PRAGMA foreign_keys = ON");
  for (const address of [email, teammateEmail, mobileEmail]) {
    db.prepare("DELETE FROM users WHERE email = ?").run(address);
    db.prepare("DELETE FROM login_attempts WHERE email = ?").run(address);
  }
  db.prepare("DELETE FROM books WHERE name = ? OR name = ?").run(
    bookName,
    `${bookName} 已编辑`,
  );
  db.close();
});

test("注册、访问保护、单词书管理、管理员状态及退出", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
  for (const route of ["/books", "/admin-users"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(
      0,
    );
  }
  await page.screenshot({
    path: "test-results/signin-desktop.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  await page.getByRole("link", { name: "注册管理员", exact: true }).click();
  await page.getByLabel("姓名", { exact: true }).fill("林知远");
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码", { exact: true }).fill("different-password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "两次输入的密码不一致" }),
  ).toBeVisible();
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/books$/);
  await expect(
    page.getByRole("heading", { name: "单词书管理", exact: true }),
  ).toBeVisible();
  await expect(page.locator("aside")).toContainText(email);
  await page.goto("/");
  await expect(page).toHaveURL(/\/books$/);
  await page.goto("/signin");
  await expect(page).toHaveURL(/\/books$/);
  await expect(
    page.getByRole("heading", { name: "单词书管理", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(9);
  await page.screenshot({
    path: "test-results/books-desktop.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  await page.getByRole("button", { name: "网格视图", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(8);
  await page.screenshot({
    path: "test-results/books-grid-desktop.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  await page.getByRole("button", { name: "列表视图", exact: true }).click();
  await page.getByRole("button", { name: "新建单词书", exact: true }).click();
  await page.getByLabel("单词书名称", { exact: true }).fill(bookName);
  await page.getByLabel("封面英文标题", { exact: true }).fill("TEST BOOK");
  await page.getByLabel("单词数量", { exact: true }).fill("123");
  await page.getByRole("radio", { name: "蓝色", exact: true }).check();
  await page.getByRole("button", { name: "保存单词书", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "搜索单词书", exact: true })
    .fill(bookName);
  let row = page.getByRole("row").filter({ hasText: bookName });
  await expect(row).toContainText("123");
  await expect(row).toContainText("草稿");
  await row
    .getByRole("button", { name: `${bookName}的操作`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: "发布", exact: true }).click();
  await expect(row).toContainText("已发布");
  await row
    .getByRole("button", { name: `编辑${bookName}`, exact: true })
    .click();
  await page
    .getByLabel("单词书名称", { exact: true })
    .fill(`${bookName} 已编辑`);
  await page.getByRole("button", { name: "保存单词书", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  row = page.getByRole("row").filter({ hasText: `${bookName} 已编辑` });
  await expect(row).toBeVisible();
  await page.reload();
  await page
    .getByRole("textbox", { name: "搜索单词书", exact: true })
    .fill(`${bookName} 已编辑`);
  await expect(row).toBeVisible();
  await row
    .getByRole("button", { name: `${bookName} 已编辑的操作`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(
    page.getByText("没有找到匹配的单词书", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "清除筛选", exact: true })
    .first()
    .click();
  await expect(page.getByRole("row")).toHaveCount(9);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "管理员管理", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin-users$/);
  const self = page.getByRole("row").filter({ hasText: email });
  await self.getByRole("button", { name: "林知远的操作", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "停用账号", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "新增管理员", exact: true }).click();
  await page.getByLabel("姓名", { exact: true }).fill("陈以安");
  await page.getByLabel("邮箱", { exact: true }).fill(teammateEmail);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "保存管理员", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/admin-users-desktop.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto("http://localhost:3000/signin");
  await other.getByLabel("邮箱", { exact: true }).fill(teammateEmail);
  await other.getByLabel("密码", { exact: true }).fill(password);
  await other.getByRole("button", { name: "登录", exact: true }).click();
  await expect(other).toHaveURL(/\/books$/);
  const teammate = page.getByRole("row").filter({ hasText: teammateEmail });
  await teammate
    .getByRole("button", { name: "陈以安的操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "停用账号", exact: true }).click();
  await page.getByRole("button", { name: "确认停用", exact: true }).click();
  await expect(teammate).toContainText("已停用");
  await other.reload();
  await expect(other).toHaveURL(/\/signin$/);
  await other.getByLabel("邮箱", { exact: true }).fill(teammateEmail);
  await other.getByLabel("密码", { exact: true }).fill(password);
  await other.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    other.getByRole("alert").filter({ hasText: "邮箱或密码错误" }),
  ).toBeVisible();
  await teammate
    .getByRole("button", { name: "陈以安的操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "启用账号", exact: true }).click();
  await expect(teammate).toContainText("正常");
  await otherContext.close();
  const oldCookies = await page.context().cookies();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.context().addCookies(oldCookies);
  await page.goto("/books");
  await expect(page).toHaveURL(/\/signin$/);
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "邮箱或密码错误" }),
  ).toBeVisible();
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/books$/);
  expect(errors).toEqual([]);
});

test("手机页面、抽屉导航和表单尺寸", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "创建管理员账号", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/signup-mobile.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  await page.getByLabel("姓名", { exact: true }).fill("移动端管理员");
  await page.getByLabel("邮箱", { exact: true }).fill(mobileEmail);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(page).toHaveURL(/\/books$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/books-mobile.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  await page.getByRole("button", { name: "新建单词书", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/book-dialog-mobile.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(mobileEmail);
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "test-results/sidebar-mobile.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "管理员管理", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin-users$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "退出登录", exact: true })
    .click();
  await expect(page).toHaveURL(/\/signin$/);
});

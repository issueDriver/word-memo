import {
  test,
  expect,
  type Page,
  type Request,
  type BrowserContext,
} from "@playwright/test";
import { createHash } from "node:crypto";
import postgres from "postgres";

test.describe.configure({ mode: "serial" });

// Always connect to the disposable database, never DATABASE_URL from .env.
const sql = postgres(
  "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
  { prepare: false, max: 1 },
);
const email = "owner@example.com";
const teammateEmail = "teammate@example.com";
const password = "WordMemo-2026!";

test.afterAll(async () => {
  await sql.end();
});

async function login(page: Page, address = email) {
  await page.goto("/signin");
  await page.getByLabel("邮箱", { exact: true }).fill(address);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/books$/);
}

async function replay(context: BrowserContext, request: Request) {
  return context.request.post("/books", {
    headers: {
      "next-action": request.headers()["next-action"],
      "content-type": request.headers()["content-type"],
      origin: "http://127.0.0.1:3100",
    },
    data: request.postDataBuffer()!,
  });
}

test("首次注册、角色权限、管理员编辑及七天会话", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const route of ["/", "/books", "/admin-users", "/signin"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/signup$/);
  }
  await expect(
    page.getByRole("heading", { name: "注册系统管理员" }),
  ).toBeVisible();
  await page.getByLabel("姓名", { exact: true }).fill("系统管理员");
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码", { exact: true }).fill("different-password");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "两次输入的密码不一致" }),
  ).toBeVisible();
  await page.getByLabel("确认密码", { exact: true }).fill(password);
  const signupRequest = page.waitForRequest(
    (request) => !!request.headers()["next-action"],
  );
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  const bootstrapRequest = await signupRequest;
  await expect(page).toHaveURL(/\/books$/);
  await expect(page.locator("aside")).toContainText(email);
  await expect(page.getByRole("heading", { name: "单词书管理" })).toBeVisible();
  const [owner] = await sql`select * from "admin-users"`;
  expect(owner.role).toBe("system_admin");
  expect(owner.password_hash).not.toBe(password);
  const cookie = (await page.context().cookies()).find(
    (entry) => entry.name === "word-memo-session",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(604700);
  expect(cookie.expires - Date.now() / 1000).toBeLessThanOrEqual(604800);
  const [session] = await sql`select * from "admin-session"`;
  expect(session.id).toBe(
    createHash("sha256").update(cookie.value).digest("hex"),
  );
  expect(
    new Date(session.expires_at).getTime() -
      new Date(session.created_at).getTime(),
  ).toBeCloseTo(604800000, -3);

  const guest = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const guestPage = await guest.newPage();
  await guestPage.goto("/signup");
  await expect(guestPage).toHaveURL(/\/signin$/);
  await replay(guest, bootstrapRequest);
  expect((await sql`select id from "admin-users"`).length).toBe(1);
  await guest.close();

  await page.getByRole("link", { name: "管理员管理", exact: true }).click();
  const self = page.getByRole("row").filter({ hasText: email });
  await self.getByRole("button", { name: "系统管理员", exact: true }).click();
  await page.getByRole("combobox", { name: "角色", exact: true }).click();
  await page.getByRole("option", { name: "普通管理员", exact: true }).click();
  await page.getByRole("button", { name: "保存管理员", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "必须保留至少一位" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "新增管理员", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("姓名", { exact: true })
    .fill("普通管理员");
  await page
    .getByRole("dialog")
    .getByLabel("邮箱", { exact: true })
    .fill(teammateEmail);
  await page
    .getByRole("dialog")
    .getByLabel("密码", { exact: true })
    .fill(password);
  await page
    .getByRole("dialog")
    .getByLabel("确认密码", { exact: true })
    .fill(password);
  const creating = page.waitForRequest(
    (request) => !!request.headers()["next-action"],
  );
  await page.getByRole("button", { name: "保存管理员", exact: true }).click();
  const createRequest = await creating;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const teammate = page.getByRole("row").filter({ hasText: teammateEmail });
  await expect(teammate).toContainText("普通管理员");

  const otherContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  const other = await otherContext.newPage();
  await login(other, teammateEmail);
  await expect(
    other.getByRole("link", { name: "管理员管理", exact: true }),
  ).toHaveCount(0);
  await other.goto("/admin-users");
  await expect(other).toHaveURL(/\/books$/);
  expect(await (await replay(otherContext, createRequest)).text()).toContain(
    "没有管理员管理权限",
  );
  expect((await sql`select id from "admin-users"`).length).toBe(2);

  // Role changes revoke sessions and are reflected on the next login.
  await teammate
    .getByRole("button", { name: "普通管理员", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("姓名", { exact: true })
    .fill("团队管理员");
  await page.getByRole("combobox", { name: "角色", exact: true }).click();
  await page.getByRole("option", { name: "系统管理员", exact: true }).click();
  await page.getByRole("button", { name: "保存管理员", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(teammate).toContainText("系统管理员");
  await other.reload();
  await expect(other).toHaveURL(/\/signin$/);
  await login(other, teammateEmail);
  await expect(
    other.getByRole("link", { name: "管理员管理", exact: true }),
  ).toBeVisible();
  await teammate
    .getByRole("button", { name: "团队管理员", exact: true })
    .click();
  await page.getByRole("combobox", { name: "角色", exact: true }).click();
  await page.getByRole("option", { name: "普通管理员", exact: true }).click();
  await page.getByRole("button", { name: "保存管理员", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await other.reload();
  await expect(other).toHaveURL(/\/signin$/);

  // Email uniqueness is case insensitive.
  await teammate
    .getByRole("button", { name: "团队管理员", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("邮箱", { exact: true })
    .fill(email.toUpperCase());
  await page.getByRole("button", { name: "保存管理员", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "该邮箱已被使用" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();

  await login(other, teammateEmail);
  await teammate
    .getByRole("button", { name: "团队管理员的操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "停用账号", exact: true }).click();
  const toggling = page.waitForRequest(
    (request) => !!request.headers()["next-action"],
  );
  await page.getByRole("button", { name: "确认停用", exact: true }).click();
  const toggleRequest = await toggling;
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
    .getByRole("button", { name: "团队管理员的操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "启用账号", exact: true }).click();
  await expect(teammate).toContainText("正常");
  await login(other, teammateEmail);
  expect(await (await replay(otherContext, toggleRequest)).text()).toContain(
    "没有管理员管理权限",
  );
  const [ordinary] =
    await sql`select id, status from "admin-users" where email = ${teammateEmail}`;
  expect(ordinary.status).toBe("active");
  await sql`update "admin-session" set expires_at = now() - interval '1 minute' where admin_user_id = ${ordinary.id}`;
  await other.reload();
  await expect(other).toHaveURL(/\/signin$/);
  await otherContext.close();

  await page.screenshot({
    path: "test-results/admin-users-desktop.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
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
  await login(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
  const navigation = page.getByRole("dialog");
  await expect(navigation).toContainText(email);
  await navigation
    .getByRole("link", { name: "管理员管理", exact: true })
    .click();
  await page.getByRole("button", { name: "新增管理员", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-form-mobile.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  expect(errors).toEqual([]);
});

test("单词书录入、卡片、标签及 bookId 外键", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const coverUrl = "https://covers.openlibrary.org/b/isbn/9781107600942-L.jpg";
  await page.route(coverUrl, (route) =>
    route.fulfill({
      path: "tests/fixtures/vocabulary-cover.jpg",
      contentType: "image/jpeg",
    }),
  );
  await page.route(
    "https://covers.openlibrary.org/b/invalid-cover.jpg",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: "invalid image",
      }),
  );
  await login(page, teammateEmail);
  await expect(page.getByText("暂无单词书", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "新建单词书", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("标题", { exact: true }).fill("四级核心词汇");
  await dialog.getByLabel("单词数量", { exact: true }).fill("2600");
  await dialog.getByLabel("bookId", { exact: true }).fill("CET4_1");
  await dialog
    .getByLabel("封面 URL", { exact: true })
    .fill("javascript:alert(1)");
  await dialog
    .getByLabel("标签（逗号分隔）", { exact: true })
    .fill(" 大学英语, 四级，核心词汇, 四级, all, ");
  await dialog.getByRole("button", { name: "保存单词书", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("HTTP 或 HTTPS");
  await dialog.getByLabel("封面 URL", { exact: true }).fill(coverUrl);
  await dialog.getByLabel("标签（逗号分隔）", { exact: true }).focus();
  const creating = page.waitForRequest(
    (request) => !!request.headers()["next-action"],
  );
  await dialog.getByRole("button", { name: "保存单词书", exact: true }).click();
  const createRequest = await creating;
  await expect(dialog).toHaveCount(0);
  let card = page.getByRole("article", { name: "四级核心词汇", exact: true });
  await expect(card).toContainText("2,600");
  await expect(card).toContainText("bookId: CET4_1");
  const image = card.getByRole("img", {
    name: "四级核心词汇封面",
    exact: true,
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBeGreaterThan(1);
  const [book] = await sql`select * from books where "bookId" = 'CET4_1'`;
  expect(book.tags).toEqual(["大学英语", "四级", "核心词汇", "all"]);
  expect(book.wordCount).toBe(2600);

  // Reject unauthenticated mutation even when the Server Action is known.
  const guest = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const response = await replay(guest, createRequest);
  expect(
    (await response.text()) + JSON.stringify(response.headers()),
  ).toContain("signin");
  expect((await sql`select id from books`).length).toBe(1);
  await guest.close();

  await sql`insert into words ("headWord", "bookId") values ('hello', 'CET4_1')`;
  await expect(
    sql`insert into words ("headWord", "bookId") values ('orphan', 'missing-book')`,
  ).rejects.toMatchObject({ code: "23503" });
  await card
    .getByRole("button", { name: "编辑四级核心词汇", exact: true })
    .click();
  await expect(
    dialog.getByLabel("标签（逗号分隔）", { exact: true }),
  ).toHaveValue("大学英语, 四级, 核心词汇, all");
  await dialog
    .getByLabel("标题", { exact: true })
    .fill("四级核心词汇 · 修订版");
  await dialog.getByLabel("单词数量", { exact: true }).fill("2800");
  await dialog.getByLabel("bookId", { exact: true }).fill("CET4_2026");
  await dialog.getByRole("button", { name: "保存单词书", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  card = page.getByRole("article", {
    name: "四级核心词汇 · 修订版",
    exact: true,
  });
  await expect(card).toContainText("bookId: CET4_2026");
  const [word] =
    await sql`select "bookId" from words where "headWord" = 'hello'`;
  expect(word.bookId).toBe("CET4_2026");
  await page.reload();
  await expect(card).toContainText("2,800");

  await page.getByRole("button", { name: "新建单词书", exact: true }).click();
  await dialog.getByLabel("标题", { exact: true }).fill("六级精选词汇");
  await dialog.getByLabel("单词数量", { exact: true }).fill("3200");
  await dialog.getByLabel("bookId", { exact: true }).fill("CET4_2026");
  await dialog.getByLabel("封面 URL", { exact: true }).fill(coverUrl);
  await dialog
    .getByLabel("标签（逗号分隔）", { exact: true })
    .fill("六级, 大学英语");
  await dialog.getByRole("button", { name: "保存单词书", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("bookId 已存在");
  await dialog.getByLabel("bookId", { exact: true }).fill("CET6_1");
  await dialog.getByRole("button", { name: "保存单词书", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(2);
  await card
    .getByRole("button", { name: "四级核心词汇 · 修订版的操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "发布", exact: true }).click();
  await expect(card).toContainText("已发布");
  await page.getByRole("button", { name: /^已发布/ }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: /^全部单词书/ }).click();
  await page.getByRole("combobox", { name: "筛选标签", exact: true }).click();
  await page.getByRole("option", { name: "all", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await page
    .getByRole("textbox", { name: "搜索单词书", exact: true })
    .fill("CET6_1");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("六级精选词汇");
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await page.getByRole("combobox", { name: "排序方式", exact: true }).click();
  await page.getByRole("option", { name: "单词数量", exact: true }).click();
  await expect(page.getByRole("article").first()).toContainText("六级精选词汇");
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/books-desktop.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });

  await card
    .getByRole("button", { name: "四级核心词汇 · 修订版的操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await confirmation
    .getByRole("button", { name: "确认删除", exact: true })
    .click();
  await expect(confirmation.getByRole("alert")).toContainText("已关联单词");
  expect((await sql`select id from books where id = ${book.id}`).length).toBe(
    1,
  );
  await confirmation.getByRole("button", { name: "取消", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/books-mobile.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  await card
    .getByRole("button", { name: "编辑四级核心词汇 · 修订版", exact: true })
    .click();
  await expect(dialog).toHaveCSS("opacity", "1");
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/book-dialog-mobile.png",
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  await dialog
    .getByLabel("封面 URL", { exact: true })
    .fill("https://covers.openlibrary.org/b/invalid-cover.jpg");
  await dialog.getByRole("button", { name: "保存单词书", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card.getByRole("img", { name: /暂无可用封面/ })).toBeVisible();
  await sql`delete from words where "bookId" = 'CET4_2026'`;
  await card
    .getByRole("button", { name: "四级核心词汇 · 修订版的操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  await confirmation
    .getByRole("button", { name: "确认删除", exact: true })
    .click();
  await expect(confirmation).toHaveCount(0);
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
});

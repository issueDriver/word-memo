# Word Memo Admin

基于 Next.js App Router、shadcn/ui（Base UI）和 Tailwind CSS 4 的中文管理后台。

## 本地运行

需要 Node.js 22.13 或更新版本，以及 pnpm 9。

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000，首次使用请在 `/signup` 注册管理员，注册成功后自动登录。

| 路径           | 页面                                     |
| -------------- | ---------------------------------------- |
| `/`            | 根据登录状态跳转至 `/books` 或 `/signin` |
| `/signup`      | 管理员注册：姓名、邮箱、密码、确认密码   |
| `/signin`      | 邮箱及密码登录                           |
| `/books`       | 单词书管理，需要登录                     |
| `/admin-users` | 管理员管理，需要登录                     |

单词书支持新建、编辑、删除、发布、转为草稿、搜索、分类筛选、排序及列表/网格视图。初始的八本书为示例书目，词数是书籍元数据，当前不包含逐词内容编辑。

管理员支持新增、编辑、启用和停用。当前账号不能停用自身；停用账号会撤销该账号的会话。所有注册账号拥有相同的管理员权限，公开注册按当前需求开放。

## 数据和会话

数据保存在 `.data/word-memo.sqlite`，重启后保留。密码使用带随机盐的 scrypt 哈希；会话使用 iron-session 的加密 HttpOnly Cookie，并在数据库中校验有效期及撤销状态。登录连续失败五次后，该邮箱会被限制十分钟。

开发环境首次启动时会生成 `.data/session-secret`。生产环境可通过 `SESSION_PASSWORD` 设置至少 32 个字符的随机密钥，并需使用 HTTPS。备份与迁移时应保留数据库和密钥，`.data/` 已加入 Git 忽略列表。

该存储方案适合本地开发或单实例部署。部署时需要可持久化的可写磁盘；多实例或临时文件系统应接入共享数据库。公开上线前可按实际账号策略收紧注册入口。

## Drizzle ORM 与 Supabase

已安装 `drizzle-orm`、`postgres`，以及开发工具 `drizzle-kit`、`@next/env`。在项目根目录 `.env` 中设置 `DATABASE_URL`，使用 Supabase 提供的 PostgreSQL 连接字符串。`.env` 已被 Git 忽略。

- `db/index.ts`：服务端连接入口，通过 `import { db } from "@/db"` 使用。连接按查询建立，开发环境复用连接池，并设置 `prepare: false` 兼容 Supabase 的事务连接池。
- `db/schema.ts`：空的 PostgreSQL schema，未定义任何默认表。
- `drizzle.config.ts`：Drizzle Kit 配置，按 Next.js 的规则读取 `.env*`，后续迁移文件输出到 `drizzle/`。

以下命令仅已配置，尚未执行：

```bash
pnpm db:pull      # 从已有数据库读取表结构，生成本地 schema 文件
pnpm db:generate  # 根据后续定义的 schema 生成本地迁移
pnpm db:migrate   # 将已生成的迁移应用到数据库
pnpm db:studio    # 打开 Drizzle Studio
```

本次仅添加依赖与连接配置，没有创建表、生成迁移、执行 SQL 或修改 Supabase 数据。现有登录、管理员和单词书业务仍使用 `lib/db.ts` 中的本地 SQLite 实现，尚未迁移到 Supabase。

## 验证

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
pnpm test:e2e
```

端到端测试使用独立测试账号，结束后清理测试数据，覆盖认证、受保护路由、单词书增删改、管理员停用和会话撤销、手机布局与抽屉导航。截图和失败追踪位于 `test-results/`。

测试在 macOS 上优先使用已安装的 Google Chrome；其他环境先运行 `pnpm exec playwright install chromium`，或通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定浏览器。测试服务地址为 `http://localhost:3000`。

登录页照片来自 [Unsplash](https://images.unsplash.com/photo-1507842217343-583bb7270b66)，图片已保存在 `public/library.jpg`，运行时无需请求外部图片。

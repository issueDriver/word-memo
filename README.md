# Word Memo Admin

基于 Next.js App Router、shadcn/ui（Base UI）和 Tailwind CSS 4 的中文管理后台。

## 本地运行

需要 Node.js 22.13 或更新版本，以及 pnpm 9。

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

先在 `.env` 设置 Supabase 的 `DATABASE_URL`（推荐 Session pooler）。打开 http://localhost:3000，数据库中没有管理员时自动跳转到 `/signup`；首次注册创建系统管理员并自动登录。已有管理员后，注册入口关闭并跳转到登录页。

| 路径           | 页面                                                        |
| -------------- | ----------------------------------------------------------- |
| `/`            | 根据初始化和登录状态跳转至 `/signup`、`/signin` 或 `/books` |
| `/signup`      | 仅首位系统管理员注册：姓名、邮箱、密码、确认密码            |
| `/signin`      | 邮箱及密码登录                                              |
| `/books`       | 单词书管理，需要登录                                        |
| `/admin-users` | 管理员管理，仅系统管理员                                    |

单词书通过弹框录入或编辑标题、单词数量、封面 URL、唯一的 `bookId` 和逗号分隔的标签。标签会去除空白、空项和重复值，也支持中文逗号。卡片展示完整封面、标题、单词数量、bookId 和标签，支持搜索、标签筛选、排序、发布、转为草稿和删除。词数是手动录入的书籍元数据，当前不包含逐词内容编辑。

系统管理员支持新增、编辑、启用和停用管理员，并可设置系统管理员或普通管理员角色。普通管理员仅能管理单词书，侧边栏隐藏管理员入口，页面和服务端操作均检查权限。当前账号不能停用自身，系统必须保留至少一位正常的系统管理员。角色变更或停用会撤销目标账号全部会话，需要重新登录。

## 数据和会话

管理员、会话、单词书和单词均通过 Drizzle ORM 存储在 Supabase PostgreSQL，不再使用 SQLite。原有 `.data/word-memo.sqlite` 文件保留作为旧数据，内容不会自动导入新表，也不再预置示例书籍。首次初始化以 Supabase 管理员表为准。

密码使用随机盐的 scrypt 哈希。登录后发放 256 位随机令牌，通过 HttpOnly、SameSite=Lax Cookie 保存，数据库仅保存 SHA-256 摘要。Cookie 与数据库会话均在登录后 7 天过期，不滑动续期；退出登录立即撤销会话。已存在账号连续登录失败五次后限制十分钟。

生产环境须使用 HTTPS（启用 Secure Cookie）。`.env*`、旧 `.data/`、测试结果均已加入 Git 忽略列表。封面要求 HTTP/HTTPS URL，由浏览器直接加载，不经过服务器图片代理；加载失败时显示占位图标。

## Drizzle ORM 与 Supabase

已安装 `drizzle-orm`、`postgres`，以及开发工具 `drizzle-kit`、`@next/env`。在项目根目录 `.env` 中设置 `DATABASE_URL`，使用 Supabase 提供的 PostgreSQL 连接字符串。`.env` 已被 Git 忽略。

- `db/index.ts`：服务端连接入口，通过 `import { db } from "@/db"` 使用。连接按查询建立，开发环境复用连接池，并设置 `prepare: false` 兼容 Supabase 的事务连接池。
- `db/schema.ts`：`admin-users` 管理员表、`admin-session` 会话表、`books` 单词书表和 `words` 单词表。`words.id` 使用数值模式的 bigint identity 主键，`wordRank`、`headWord`、`content`（json，TS 类型为 `unknown | null`）、`bookId` 均允许空值。
- `drizzle.config.ts`：Drizzle Kit 配置，按 Next.js 的规则读取 `.env*`，迁移文件位于 `drizzle/`。

数据库命令：

```bash
pnpm db:pull      # 从已有数据库读取表结构，生成本地 schema 文件
pnpm db:generate  # 根据 schema 变更生成本地迁移
pnpm db:migrate   # 将已生成的迁移应用到数据库
pnpm db:studio    # 打开 Drizzle Studio
```

迁移创建以上四张业务表以及 Drizzle 自身的迁移记录，不预置业务数据。所有表均开启 RLS，不提供 anon/authenticated 客户端访问策略；只允许服务端通过具备对应权限的 `DATABASE_URL` 连接访问。不要在浏览器中使用数据库连接串。首次注册通过数据库事务和表锁避免多个请求同时创建初始系统管理员。

`books.id` 是内部 UUID 主键，`books.bookId` 为唯一业务标识。`words.bookId` 通过外键引用 `books.bookId`（一对多），并建立查询索引及 Drizzle relations。修改书籍的 `bookId` 会级联更新单词；已有单词的书籍不允许删除。导入单词时必须先创建对应书籍，`bookId = null` 的单词仍可保留。

## 导入 kajweb/dict

导入来源为 [kajweb/dict](https://github.com/kajweb/dict)，固定版本 `3992bcb94c800a2fd38a9fd6ff95b2353e755363`，包含 81 本书、153,009 条单词记录。上游 `bookLists.txt` 提供书籍标题、封面和标签；ZIP 内的逐行 JSON 提供 `wordRank`、`headWord`、`content` 和 `bookId`。`content` 原样保存，不删减释义、例句、音标和其他嵌套字段，也不跨书合并重复单词。

```bash
pnpm dict:download          # 下载完整目录和 ZIP，逐文件核对 GitHub blob 哈希
pnpm dict:import --dry-run  # 只解析、校验并统计源数据，不连接数据库
pnpm db:migrate            # 应用包含 (bookId, wordRank) 唯一索引的迁移
pnpm test:dict             # 在临时 PostgreSQL 引擎中验证解析、幂等及回滚
pnpm dict:import           # 写入 .env 配置的 Supabase
pnpm dict:import --verify  # 只读核验数据库内容、逐书摘要和词数
```

下载默认保存到 `.data/dict-source/`，支持使用 `--source` 指定目录。下载器通过 jsDelivr 获取固定版本的文件，并用 GitHub API 文件哈希验证；失败时回退至 GitHub API。重复下载复用已校验的文件。原始数据、来源信息、预检查清单和导入报告均在已忽略的 `.data/` 下，不会提交到 Git。

导入按书使用事务，默认每批 500 条（`--batch-size` 支持 1 至 2000），同时处理 4 本书（`--concurrency` 支持 1 至 8）。重复执行会跳过内容相同的记录，并保留已有书籍的标题、封面、标签及发布状态；同一 `bookId + wordRank` 的已有内容不一致时终止该书导入并回滚，不覆盖用户数据。数据库按词序汇总词条字段和 JSON 的 SHA-256，与本地计算的全书摘要比较，避免传输完整词条。摘要不一致时逐条核对；JSON 表示不同则读取原值做语义比较。校验后更新实际词数。新增书籍默认为草稿。短暂断线自动重试，中断后重新运行同一命令即可续跑。

`.data/dict-import/manifest.json` 为源数据清单，`progress.json` 为逐书进度，`report.json` 为完整导入或核验后的报告。导入测试独立于实际 Supabase，不使用真实管理员账号。

## 验证

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
pnpm test:e2e
```

端到端测试启动内存 PGlite PostgreSQL 数据库，应用同一套 Drizzle 迁移，使用独立 Next.js 构建目录。不会读取或修改 Supabase 真实账号。覆盖首次注册、关闭二次注册、登录、角色编辑、普通管理员直接调用管理员 Server Action 被拒绝、最后系统管理员保护、停用、会话撤销及过期，以及单词书新增、编辑、唯一标识、标签、筛选、发布、删除保护、外键级联更新、封面失败和手机布局。截图和失败追踪位于 `test-results/`。PGlite 使用单个 PostgreSQL 引擎连接，不替代真实 PostgreSQL 的多实例并发验证。

测试在 macOS 上优先使用已安装的 Google Chrome；其他环境先运行 `pnpm exec playwright install chromium`，或通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定浏览器。测试服务使用 `http://127.0.0.1:3100`，临时数据库使用本地端口 `55439`；这两个端口需要空闲。

登录页照片来自 [Unsplash](https://images.unsplash.com/photo-1507842217343-583bb7270b66)，图片已保存在 `public/library.jpg`，运行时无需请求外部图片。

测试封面图片来自 [Cambridge University Press](https://assets.cambridge.org/97811076/00942/cover/9781107600942.jpg)，仅作为浏览器测试素材，不会预置到业务数据库。

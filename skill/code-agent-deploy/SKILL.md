---
name: code-agent-deploy
description: 把本地项目部署上线并返回访问地址：识别项目、做部署就绪改造、打包源码交给部署平台构建和部署（电脑上不需要 Docker）、根据服务器结果自动修复重试，以及查看状态、日志和回滚。适用于能通过网址访问的项目：网站、Web 应用、后端接口服务。用户只需持有部署密钥，不直接访问服务器。
---

# WEB DEPLOY 部署技能

## 目标

用户说“部署这个项目”时，自动完成从本地项目到可访问 URL 的全过程，尽量不让用户处理 Docker、服务器和网络细节。用户只需要：

1. 首次使用时在终端执行一次 `appcli auth set-key`，粘贴自己的部署密钥（在平台后台的“部署密钥”页面生成；平台没有开放注册时由管理员发放）。
2. 确认一次部署就绪改造的 diff。
3. 首次部署时确认运行参数从哪个本地文件读取（有需要时）。
4. 首次部署时决定是否迁移本地数据（检测到本地数据时询问，默认不迁移）。

命令、manifest 字段、输出和错误码以 [appcli 使用参考](references/appcli-reference.md) 为准。

## 不可违反的约束

1. 所有部署经过部署平台，通过 appcli 执行。不 SSH、不 SCP、不直连服务器、不操作远程 Docker。
2. 不读取、不打印、不索要部署密钥。缺少密钥时，请用户自己在终端执行 `! appcli auth set-key`。appcli 是从平台下载的，自带那个平台的地址，命令里不写 `--platform`；只有 `appcli auth status` 里的 `platformUrl` 为 null，或者用户明确要换一个平台时，才加上 `--platform <平台地址>`。用户还没有密钥时，请他打开平台地址（`platformUrl`），登录后在“部署密钥”页面生成（平台没有开放注册时向管理员申请）。
3. 不把 .env、密钥、Token、数据库密码、本地数据库、上传文件打进镜像。
4. 不把上传成功或 queued/running 当作部署成功，必须等到 succeeded 或 failed。
5. 显示日志前脱敏：Authorization、Cookie、password、token、secret、私钥、连接串密码、`dpk_` 开头的字符串。
6. auth、server、platform 类错误不得通过替代路径绕过；不建议开放 SSH 或 Docker API。
7. 不修改清单之外的业务代码，除非单独说明并获得同意。
8. 不在本地启动容器做预演；本地只做静态检查和构建，直接部署到服务器，根据服务器结果修复。

## 工作流

### 0. 前置检查

~~~bash
appcli version --json        # appcli 是否安装、平台支持哪些功能、有没有更新
appcli auth status --json    # 是否已配置密钥和平台地址
appcli plan --json           # 用户的套餐给多少：项目数、每个项目的内存和 CPU、能不能用数据库服务、构建次数（密钥配置好之后执行）
~~~

镜像在部署平台服务器上构建，开发者电脑不需要 Docker，也不要求用户安装或启动 Docker。

- appcli 未安装：告诉用户需要安装 appcli，停止。
- 有更新（`appcli version --json` 的 `updates`）：先更新再继续，每样在一次对话里只更新一次。
  - `updates.appcli.outdated` 为 true：告诉用户一句“部署工具有新版本，先更新一下”，执行 `updates.appcli.command`，然后重新执行 `appcli version --json`。
  - `updates.skill.outdated` 为 true：执行 `updates.skill.command`，然后重新读取它输出的目录里的 SKILL.md，按新的说明从前置检查重新开始。
  - 更新命令失败不阻塞部署：把原因告诉用户，按现有版本继续。输出里没有 `updates`、或其中没有某一项，说明这项检查不可用，跳过。
- 密钥未配置（DEPLOY_KEY_MISSING）：请用户执行 `! appcli auth set-key`，等用户完成后继续。不要加 `--platform`：appcli 已经带着它的平台地址（`auth status` 的 `platformUrl`）。只有 `platformUrl` 为 null 时才需要地址，用用户给的那一个，写成 `! appcli auth set-key --platform <平台地址>`，不猜测。
- 连不上平台（PLATFORM_UNREACHABLE）：请用户确认平台地址和所在网络，停止。
- 平台 capabilities 不支持某项功能时，相关步骤不执行，并在结果中说明。
- 套餐（`appcli plan --json` 的 `limits`，值为 null 表示不限）决定后面几步能做什么，先看再定方案：
  - `database` 为 `none`：平台不给这个用户提供 MySQL / PostgreSQL 数据库服务，只能用 SQLite；为 `shared`：可以用共享实例，不能用独享（`mode: dedicated`）；为 `dedicated`：都可以。
  - `memoryMb`、`cpus`：每个项目的上限。manifest 里申请得更多不会报错，平台按上限运行，并在部署事件里写一行 `[plan]`。
  - `sleepAfterDays`：项目连续这么多天没有人访问就会休眠（第 7 节）。
  - 命令不可用（旧平台）时跳过，按没有限制处理。

### 1. 识别项目

读取 package.json / pom.xml / build.gradle / requirements.txt / pyproject.toml、锁文件、框架配置（next.config.*、vite.config.*、application.properties/yml、settings.py 等）、已有 Dockerfile / compose / deploy.manifest.json、.env* 文件的**变量名**（不输出值）、.gitignore。

确定：

- 框架与启动方式、实际监听端口。
- 是否使用数据库、类型、文件位置（SQLite 文件在哪；MySQL/PostgreSQL 的大版本）。MySQL/PostgreSQL 由平台提供数据库服务（默认共享实例中的独立库，可选独享），见 [技术栈约定](references/stacks.md)。项目需要的数据库服务超出用户的套餐（第 0 节）时，在改造前就告诉用户：要么在平台后台的“套餐”页面升级，要么由用户决定把项目改成 SQLite——换数据库是业务改动，不自行决定。
- 附件、上传、生成文件的写入位置。
- 运行时需要的环境变量；哪些是构建时变量（如 `NEXT_PUBLIC_*`）。
- 硬编码的 localhost 地址、本地绝对路径。
- 原生依赖（better-sqlite3、sharp、prisma 等）及构建时是否需要联网下载。
- 本地 SQLite 文件和附件目录的实际位置（供第 4.5 节询问）。

已有 manifest 且含 applicationId 时，先 `appcli status --json` 了解项目状态，跳过已完成的改造项。

### 2. 部署就绪改造

按下表生成改动，**一次性展示完整 diff，请用户确认一次**。已验收通过的完整写法见 [示例项目](references/example-nextjs-sqlite/)（Next.js + SQLite），优先照它写；Java、Python 和 MySQL/PostgreSQL 按 [技术栈约定](references/stacks.md)。改动后本地 `npm run dev` 必须保持原有行为（新增的环境变量都带本地原值作为默认值）。

| 改动 | 要求 |
|---|---|
| Dockerfile | 多阶段构建；基础镜像优先用平台封装的 `node-base`（只写名称），也可以用其他公共镜像（写明确版本），可在其上安装或升级所需内容，见 [基础镜像约定](references/base-images.md)；运行阶段 `USER 10001`；只复制运行所需产物；为 buildEnv 中每个变量在构建阶段写 `ARG X` 和 `ENV X=$X`；使用迁移工具时启动命令先执行迁移（如 `prisma migrate deploy`） |
| .dockerignore | 排除 .env*、.appcli、node_modules、.next、.git、本地数据库（含 -wal/-shm）、上传目录、备份 |
| .gitignore | 加入 `.appcli/` |
| .npmrc | 指向阿里 npmmirror，并按依赖加二进制镜像（见基础镜像约定“npm 镜像源”）；Dockerfile 在 `npm ci` 前复制 |
| deploy.manifest.json | 按 [appcli 使用参考](references/appcli-reference.md) 第 2 节；applicationId 留空；用 `appcli validate --json` 校验 |
| 健康检查接口 | 默认 `/api/health`，返回 200 和简单 JSON；可做只读数据库连通检查；不写数据、不含业务逻辑；**必须从登录拦截、i18n 重定向等 middleware 中排除**（Next.js 在 middleware 的 matcher 中排除该路径） |
| 监听 | 监听 `0.0.0.0`，端口读 `PORT` |
| Next.js | `output: 'standalone'`；standalone 产物需复制 `public` 和 `.next/static` |
| 数据路径 | 数据库读 `DATABASE_URL`（Java 读 `JDBC_DATABASE_URL`、`DB_USER`、`DB_PASSWORD`），附件读 `UPLOAD_DIR`，生成文件读 `GENERATED_DIR` |
| 绝对地址 | 服务端代码改读 `PUBLIC_URL`（不带末尾斜杠）；客户端代码改读一个 `NEXT_PUBLIC_*` 变量，在 manifest buildEnv 中声明为 `from: "publicUrl"` |
| Cookie | 有登录功能时使用带项目名的唯一 Cookie 名称；访问地址通常是 HTTPS，Cookie 的 `Secure` 按**本次请求**的协议决定（请求头 `X-Forwarded-Proto`，如 Express `trust proxy`），框架做不到时不设 Secure，不能写死为 true |

注意：

- 只读根文件系统下，应用只能写声明的存储目录和 /tmp。发现写入其他位置（如项目目录下的 `data/`、`public/uploads/`）时，改为读取对应环境变量，并在 manifest storage 中声明。
- Next.js 使用图片优化或 ISR 时，在 storage 中声明 `/app/.next/cache` 为 ephemeral。
- 私有附件不能放在公开静态目录，下载需经业务鉴权接口。
- 项目已有的运行时版本约束优先，按需选用 `node-base` 或对应版本的公共镜像；用 apt 前先换阿里云源（见基础镜像约定）。
- 使用 better-sqlite3 等原生模块时，`.npmrc` 配置二进制镜像，优先选用有预编译文件的版本；没有时在构建阶段安装 python3、make、g++ 从源码编译。新项目也可考虑 Node 内置的 `node:sqlite`，无需原生编译。
- 使用 `next/font/google` 时，构建要访问 Google，国内通常不可达：改为 `next/font/local` 并把字体文件放进项目（属于改造清单之外的改动，单独说明并征得同意）。
- `NEXT_PUBLIC_*` 等构建时变量只能放在 buildEnv，不能放在 env；buildEnv 不得包含密钥。
- 构建期联网依赖统一走阿里 npmmirror（npm 包和二进制），检查方法见基础镜像约定。不要改用 registry.npmjs.org 或其他境外源。

### 3. 静态检查

部署前检查，有问题先修复（属于改造清单范围内的直接修，否则说明）：

- 构建上下文是否包含 .env、私钥、本地数据库、上传文件。
- Dockerfile 是否 COPY 凭据或 .env，是否 `ARG` 传入密钥。
- 密钥是否被声明为 `NEXT_PUBLIC_*` 或放进 buildEnv。
- .appcli/ 是否已在 .gitignore 和 .dockerignore 中。
- manifest 是否通过 `appcli validate --json`。

### 4. 运行参数

首次部署且 manifest 声明了 env 时：

1. 按 [个人项目配置](references/personal-configuration.md)“线上值与本地值不同的两类参数”给每个参数分类，列出参数名、是否必填、是否敏感、线上值来源（不显示值）：
   - 应用自用的签名密钥（SESSION_SECRET、JWT_SECRET、NEXTAUTH_SECRET 等）：默认在 manifest 中写 `generate`，由平台生成新值。
   - 用于解密已存数据的密钥：用户选择迁移本地数据时沿用本地值（`source`），否则 `generate`。
   - 第三方服务凭据：问用户“这些凭据是开发测试用的吗？上线后其他人使用会消耗这个账号的额度或产生费用”。沿用则 `source`；另用则 `manual`，请用户自己执行 `! appcli config set <名称>` 输入。
   - 普通配置：`source`。
2. 请用户确认本地来源文件（例如 `.env.local`）。只提交声明的参数，不整文件上传；排除镜像仓库凭据、部署密钥、私钥和与本项目无关的变量。
3. 值是 localhost 地址或本机路径时标出，询问线上应使用的值，不猜测。
4. 部署返回 `CONFIG_MISSING_REQUIRED` 且 `details.manual` 不为空时，请用户执行 `! appcli config set <名称>`，完成后再部署。
5. 之后的部署以平台值为准，appcli 只补齐新增的缺失项（包括为新增的 generate 参数生成值）。

详细规则见 [个人项目配置](references/personal-configuration.md)。

### 4.5 本地数据迁移（仅首次，可选）

仅在项目从未成功部署过（manifest 无 applicationId，或 `appcli status --json` 中 `everSucceeded` 为 false）且检测到本地 SQLite 文件、附件目录，或项目使用本地 MySQL/PostgreSQL 时执行。MySQL/PostgreSQL 的数据通过用户导出的 SQL 文件迁移（写法见 [技术栈约定](references/stacks.md)），AI 不直接连接用户的数据库：

1. 列出将迁移的内容：数据库文件路径与大小、各附件/生成文件目录的路径、文件数和总大小。
2. 提醒其中可能有测试数据或个人信息，问用户是否迁移。**默认不迁移**：用户拒绝、未明确同意或未回答时，均不迁移。
3. 用户同意时：在 manifest 中填写 `database.localPath`（本地数据库文件的项目内相对路径）和存储项的 `localPath`（附件、生成文件目录），使用 `--import-data` 部署。appcli 会生成一致性快照，不要手动复制 .db 文件。
4. appcli 会记住这次同意（与项目 ID 绑定）：首次成功之前的自动重试会自动带上数据，重试时不必再问用户。项目 ID 变了，同意即作废。
5. 项目成功部署过后不能再导入（DATA_IMPORT_NOT_ALLOWED），告诉用户线上数据不会被覆盖。

### 4.6 部署前备份（项目设置）

项目有数据库（manifest 中 `database.type` 为 sqlite、mysql 或 postgres）且 manifest 里还没有 `backupBeforeDeploy` 时，首次部署前问用户一次：“以后每次部署和回滚前，要不要先在服务器上备份数据库？（建议开启，保留最近 5 份，出问题可以恢复）”。

- 用户同意、未明确拒绝或未回答：写 `"backupBeforeDeploy": true`。
- 用户明确不需要：写 `"backupBeforeDeploy": false`，并告诉用户这样出问题时没有部署前备份可恢复。
- 之后按这个设置执行，不再每次询问；用户要求改时修改 manifest 即可。
- 用户只想这一次例外时，用 `appcli deploy --backup` 或 `--no-backup`，不改 manifest。
- 没有数据库的项目不问，也不写这个字段。

### 5. 部署

~~~bash
appcli deploy --wait --wait-timeout 540 --json                 # 默认
appcli deploy --import-data --wait --wait-timeout 540 --json   # 用户同意迁移本地数据时
appcli deploy --no-backup --wait --wait-timeout 540 --json     # 用户要求这一次不做部署前备份时（--backup 反之）
~~~

appcli 自动完成：创建项目（首次）→ 参数补齐 → 构建 → 导出 → 分片上传 → 创建任务 → 等待结果。首次部署后确认 manifest 中已写入 applicationId。

- `--wait-timeout 540` 让单次调用在工具调用时限内返回。返回 `WAIT_TIMEOUT` 时任务仍在执行，用 `appcli deployment <deploymentId> --wait --wait-timeout 540 --json` 继续等待，不要重新 deploy。
- deploymentId 在创建任务后即写入 `.appcli/state.json`，调用中断时从那里取回。
- 用户要求停止时，queued 状态可用 `appcli cancel <deploymentId>` 取消；已在执行的任务无法取消，等待其结束。

### 6. 结果处理与自动修复

成功：报告访问 URL（第 9 节格式）。

失败：按 `error.category` 处理：

| category | 处理 |
|---|---|
| build、app | 构建失败（平台服务器上）看 `error.details.buildLogTail`（构建日志最后 200 行，`appcli deployment <id>` 的事件里有更完整的构建日志）；运行失败看 `result.logTail`、`container`、`health`。修改项目后重新部署 |
| transient | 按错误码处理：`DUPLICATE_DEPLOYMENT` 先等进行中的任务结束；`WAIT_TIMEOUT` 用 `appcli deployment` 继续等；`PREVIOUS_TASK_UNRESOLVED` 告诉用户有一次结果未知的部署，稍后再试；`PORT_IN_USE`、`BUILD_INTERRUPTED`、上传类错误原样重新 deploy 1 次（`PORT_IN_USE` 重试后仍失败时，报告错误码并建议联系管理员，访问地址不会变） |
| auth、local_env、user_input | 停下来，说明用户需要做什么 |
| server、platform | 不修改项目，不反复重试；报告错误码和信息，建议联系管理员。`AGENT_LOST`（status 为 lost）表示结果暂时未知：告诉用户，稍后用 `appcli deployment <id>` 查询，可能被更正为实际结果；`RESULT_UNKNOWN` 表示 24 小时仍无结果，用 `appcli status` 查看项目实际运行的版本 |

项目相关的 user_input 错误：`APPLICATION_NOT_FOUND`、`APPLICATION_DEACTIVATED` 时，问用户是否清空 manifest 中的 applicationId 作为新项目重新部署（新项目会有新的访问地址，旧数据不会带过来；之前的数据迁移同意不再有效，若有本地数据需要重新询问）。停用的项目也可以请管理员在 30 天内恢复，访问地址不变。

套餐相关的错误（都不是项目的问题，不修改项目去绕过，也不反复重试）：

| 错误码 | 处理 |
|---|---|
| `APPLICATION_ASLEEP` | 项目在休眠。执行 `appcli wake --wait --json`，成功后重试原来的命令（`appcli deploy` 自己会先唤醒，不会遇到这个错误） |
| `PLAN_LIMIT_EXCEEDED` | 套餐装不下：项目数超出，或用了套餐不含的数据库服务。把 `message` 转述给用户，请他在平台后台的“套餐”页面升级，或停用不再需要的项目 |
| `BUILD_QUOTA_EXCEEDED` | 24 小时内的构建次数用完。告诉用户 `details.retryAt` 之后可以再部署，或升级套餐；在那之前不要重试 |
| `PROJECT_QUOTA_EXCEEDED` | 项目数达到上限，不能新建项目。同上，请用户升级或停用别的项目 |

部署事件里出现 `[plan]` 一行，表示这次按套餐的内存 / CPU 上限运行，低于 manifest 里申请的。之后如果应用启动失败且像是内存不足（容器退出码 137、日志里 OOM、`JavaScript heap out of memory`），不要靠调大 manifest 的 memory 来修（不会生效）：告诉用户当前套餐每个项目的内存上限，由他决定升级套餐还是让应用少用内存。

自动修复规则：

- 同一次部署请求最多自动重新部署 3 次。仍失败时停下，汇总每次的错误和已做的改动，请用户决定。
- 修复范围仍限于改造清单；需要改业务代码或数据结构时，先说明再征得同意。
- 每次修复前说明判断依据（引用具体日志行）。
- `restoredPrevious: true` 表示访问 URL 仍在运行上一版本，告诉用户这一点，不必慌忙重试。
- 首次部署失败时访问 URL 暂不可用。

常见失败与修复方向：

| 现象 | 常见原因 | 修复 |
|---|---|---|
| BUILD_FAILED，npm 下载失败或超时 | 未使用 npmmirror（例如 `.npmrc` 没有复制进构建阶段，或被 `.dockerignore` 排除） | 检查 `.npmrc` 存在、未被排除、已在 `npm ci` 前 COPY，yarn.lock 地址已替换；平台服务器本身能访问 npmmirror |
| REGISTRY_UNREACHABLE | 构建时拉不到基础镜像 | 检查镜像名和版本标签是否存在；非 Docker Hub 的仓库可能无法访问，改用 Docker Hub 上的同类镜像或 `node-base`；`node-base` 也拉不到时属于服务器问题，告诉用户联系管理员 |
| SOURCE_INVALID | 源码包含不允许的内容（指向项目外的链接等）、超过 500MB，或 Dockerfile 不在包里 | 按消息调整 `.dockerignore` 或 manifest 中的 dockerfile 路径；大文件用 `.dockerignore` 排除 |
| BUILD_TIMEOUT | 构建超过 30 分钟 | 检查是否在构建中下载了大量内容或卡在网络请求；减少构建步骤 |
| BUILD_FAILED，安装脚本访问 github.com 超时 | 某个包在下载二进制，未配置镜像 | 在 `.npmrc` 或构建阶段 ENV 中为该包配置 npmmirror 二进制镜像 |
| BUILD_FAILED，原生模块编译或 prebuild 下载超时 | 构建阶段缺编译工具，或在尝试从 GitHub 下载预编译文件 | 改用有预编译文件的版本，或在构建阶段安装编译工具从源码编译（见基础镜像约定） |
| CONTAINER_START_FAILED，Cannot find module | standalone 产物缺文件或原生模块未复制 | 修正 Dockerfile 复制步骤 |
| CONTAINER_START_FAILED，EACCES / EROFS | 写入了未声明目录或目录权限不对 | 改写入路径到声明存储或 /tmp，补充 storage 声明 |
| HEALTHCHECK_FAILED，connection refused | 监听 127.0.0.1 或端口不符 | 监听 0.0.0.0、读 PORT，核对 containerPort |
| HEALTHCHECK_FAILED，404 | 健康接口路径不存在 | 核对 healthcheckPath 和路由 |
| HEALTHCHECK_FAILED，lastStatus 为 3xx | 健康接口被登录拦截或 i18n 重定向（看 lastLocation） | 在 middleware 中排除健康检查路径 |
| HEALTHCHECK_FAILED，超时 | 启动慢或迁移耗时 | 调大 healthTimeoutSeconds（≤600），查看日志 |
| 启动时报缺环境变量 / CONFIG_MISSING_REQUIRED | 必填参数未声明或未提交 | 补充 env 声明，按第 4 节向用户确认来源后提交 |
| 客户端变量为空（`NEXT_PUBLIC_*` undefined） | 构建时变量未通过 buildEnv 传入，或 Dockerfile 未声明 ARG | 补 buildEnv 和 Dockerfile ARG/ENV |
| 页面能开但资源/链接 404 或跳到 localhost | 绝对地址硬编码 | 改用 PUBLIC_URL |
| PLATFORM_MISMATCH | 本机构建了 arm64 | 使用平台返回的 linux/amd64 |
| 部署成功但登录后立即掉线（多见于 HTTP 地址） | Cookie 设置了 Secure（或认证库按生产环境强制 Secure），HTTP 下浏览器不保存 | 按请求的 `X-Forwarded-Proto` 设置 Secure 或不设；NextAuth 等配置 URL 为 PUBLIC_URL |
| 本地正常、线上某功能报错 | 使用了只在安全上下文可用的浏览器 API（crypto.subtle、剪贴板、摄像头、Service Worker），`http://IP` 不是安全上下文 | 告诉用户该限制；能替换的改用不依赖安全上下文的实现，否则说明该功能在线上不可用 |

不得把关闭健康检查、以 root 运行、关闭只读文件系统作为修复手段。

### 7. 日常操作

~~~bash
appcli status --json
appcli logs --tail 200 --json
appcli logs --follow
appcli deployments --json
appcli config get --json
appcli config set NAME          # 交互式输入值（由用户自己在终端执行）
appcli config regenerate NAME   # 重新生成签名密钥，apply 后已登录用户会掉线
appcli config apply --wait --json
appcli deployment <id> --wait --json
appcli cancel <id>
appcli backups --json
appcli console                  # 一次性登录链接，打开参数页面
appcli wake --wait --json       # 唤醒休眠的项目
appcli plan --json              # 套餐、限额和已用量
~~~

休眠：`appcli status` 的 `status` 为 `sleeping` 时，项目被平台停下来了，数据、访问地址和历史版本都保留，仍占一个项目名额。`sleepReason` 说明原因：

- `idle`：连续多天没有人访问（套餐的 `sleepAfterDays`）。有人打开访问地址时平台自动唤醒，第一次打开要等十几秒；也可以执行 `appcli wake --wait --json`。用户问“网站打不开 / 显示正在启动”时，先看是不是这个状态。
- `plan`：套餐装不下（到期后回到免费套餐、项目数超出、用了套餐不含的数据库服务）。此时 `appcli wake` 返回 `PLAN_LIMIT_EXCEEDED`，访问地址显示“已暂停”；用户续期或升级后平台自动唤醒，不需要重新部署。

休眠中的项目可以查看状态、日志、部署记录和保存运行参数；重启、回滚、应用参数、恢复数据要先唤醒。唤醒失败（应用起不来）时项目保持休眠，报告错误码和日志，建议联系管理员。

数据恢复只在用户明确要求时执行，且需用户确认要恢复到的备份时间点：

~~~bash
appcli restore --backup <backupId> --confirm <applicationId> --wait --json
~~~

告诉用户：恢复只替换备份中包含的数据（部署前备份只含数据库，不会改动附件；没有定时备份；项目关闭了部署前备份时只有“恢复前”备份可用），恢复期间应用会短暂停止；被替换的当前数据保存为“恢复前”备份，保留 14 天，可用同一命令恢复回来；恢复失败会自动还原。项目还没有成功部署过时不能恢复。

删除项目只在用户明确要求时执行，且需用户确认项目 ID：

~~~bash
appcli delete --confirm <applicationId> --wait --json
~~~

告诉用户：这是停用，不是立即删除——容器停止、访问地址关闭，数据、端口和地址保留 30 天，期间可请平台管理员恢复（地址不变）；满 30 天后管理员才能彻底删除。停用后的项目不能再部署，除非清空 manifest 中的 applicationId 作为新项目。

### 8. 回滚

仅在用户明确要求时执行：

~~~bash
appcli deployments --json
appcli rollback --to <deploymentId> --wait --json
~~~

报告回滚前后的版本。回滚使用目标版本当时的配置结构（端口、存储、资源）和当前保存的运行参数；回滚前服务器按项目设置（backupBeforeDeploy）备份数据库。回滚不恢复数据库和附件；新版本做过不兼容迁移时提醒用户风险，必要时配合 restore 恢复部署前备份。

### 9. 交付格式

成功：

~~~text
访问地址：https://<平台分配的域名>/（外网访问：开启）
项目 ID：todo-app-k3f9
部署 ID：dep_...
本次改动：（文件列表）
持久化目录：数据库 /app/data，附件 /app/uploads（已绑定）
运行参数：已提交 3 项，平台生成 1 项（SESSION_SECRET），用户手动输入 1 项（OPENAI_API_KEY），缺失 0 项
本地数据：未迁移 / 已迁移（数据库 1 个，附件 230 个文件）
说明：入口已在服务器本机验证；访问者网络可达性未验证
套餐：免费版；按套餐上限运行（内存 256m、0.25 CPU，manifest 申请 512m / 1）；连续 7 天没有访问会休眠，再次打开时自动唤醒（约十几秒）
~~~

“套餐”一行只写与这次部署有关的：按上限运行了（事件里有 `[plan]`）、会闲置休眠（`sleepAfterDays` 不为 null）；两者都没有时省略这一行。

失败：

~~~text
项目 ID / 部署 ID：
失败阶段与错误码：
线上状态：仍运行上一版本 / 无运行版本
关键日志（已脱敏）：
已尝试的修复（第 n 次）：
需要用户决定或管理员处理的事项：
~~~

## 变更边界

可以修改（用户确认 diff 后）：第 2 节清单中的文件和代码点、本地 appcli 配置。

不修改：服务器任何配置、防火墙、Nginx、其他项目、数据库结构、业务逻辑（除非单独同意）。服务器侧问题以错误码和证据报告。

## 数据与存储

- 默认 SQLite，manifest `database.path` 默认 `/app/data/app.db`，平台注入 `DATABASE_URL=file:<database.path>`。实际驱动的 URL 格式不同时，以项目代码为准调整读取方式。
- `UPLOAD_DIR`、`GENERATED_DIR` 只在 manifest 声明了 name 为 uploads、generated 的存储时注入，值为对应 mountPath。
- 数据库、附件、正式生成文件分别声明为 persistent；缓存为 ephemeral。
- 本地数据默认不随部署上传；迁移由用户决定，只能在项目首次成功部署之前通过 `--import-data` 进行（第 4.5 节）。
- 发布和回滚不重置数据库、不覆盖附件。不在用户的线上项目中制造测试数据。

## 入口

- 访问地址由平台分配，部署后不变，以 appcli 返回的为准：`externalUrl`（平台分配的二级域名，格式由平台决定，例如 `https://<项目ID>.<域名>/`），它是应用唯一的访问地址。`publicUrl` 是注入应用的 `PUBLIC_URL`，与它相同。HTTPS 由平台的网关终止，应用自己只监听 HTTP，不自行配置域名或证书；请求头 `X-Forwarded-Proto` 是访问者实际使用的协议。不猜测地址，不硬编码示例地址。
- 外网访问默认开启（`externalAccess`）。首次部署成功后，交付时把 appcli 返回的地址告诉用户，并说明“这个地址任何人都能打开”；应用涉及内部数据或有写操作时，提醒用户确认有登录保护。然后问用户是否保留外网访问；用户要关闭时执行 `appcli access external off --json`（之后可用 `appcli access external on --json` 重新开启）。关闭前说明后果：关闭后应用无法访问，直到重新开启。用户想换外网域名前缀时执行 `appcli access name <前缀> --json`（3–63 位小写字母、数字、连字符；被占用时返回 `SUBDOMAIN_UNAVAILABLE`，请用户换一个），告诉用户旧地址随后失效、可能被别人使用，PUBLIC_URL 同样在下次部署或 apply 后切换。
- 应用运行在根路径 /，不添加 basePath。
- 部署成功表示服务器本机经入口探测通过；访问者网络是否可达不由本技能验证，报告时如实说明。

# appcli 使用参考

AI 通过 appcli 完成部署、查询和管理，不直接调用平台接口，也不连接任何服务器。用 `appcli version --json` 查看平台支持的功能（`platform.features`）：`deploy`、`rollback`、`config`、`logs`、`console`、`data_import`、`backups`、`restore`。平台没有列出的功能不得声称已完成。

## 1. 本地配置

| 位置 | 内容 |
|---|---|
| `~/.appcli/config.json` | `{ "platformUrl": "https://<平台地址>" }`，由 `auth set-key` 保存。没有这个文件时，用 appcli 自带的平台地址（它从哪个平台下载，带的就是哪个） |
| `~/.appcli/credentials`（0600） | 部署密钥 |
| 环境变量 | `APPCLI_PLATFORM_URL`、`APPCLI_DEPLOY_KEY`，优先于文件 |
| 项目内 `.appcli/state.json` | `{ "lastDeploymentId", "importDataConsent": { "applicationId", "granted" } }`；必须加入 .gitignore 和 .dockerignore |

`appcli auth set-key` 由用户自己在终端执行，交互式读取密钥。平台地址不用写，用的是 appcli 自带的那个；要换一个平台时才加 `--platform <平台地址>`。AI 不读取、不打印、不索要部署密钥。

## 2. deploy.manifest.json

位于项目根目录，不含任何密钥值，可提交版本库。

~~~json
{
  "applicationId": "todo-app-k3f9",
  "name": "todo-app",
  "containerPort": 3000,
  "healthcheckPath": "/api/health",
  "healthTimeoutSeconds": 120,
  "dockerfile": "Dockerfile",
  "buildContext": ".",
  "resources": { "memory": "512m", "cpus": 1.0 },
  "maxBodySize": "50m",
  "database": { "type": "sqlite", "path": "/app/data/app.db", "localPath": "prisma/dev.db" },
  "storage": [
    { "name": "database",   "mountPath": "/app/data",        "persistence": "persistent" },
    { "name": "uploads",    "mountPath": "/app/uploads",     "persistence": "persistent", "localPath": "public/uploads" },
    { "name": "generated",  "mountPath": "/app/generated",   "persistence": "persistent" },
    { "name": "next-cache", "mountPath": "/app/.next/cache", "persistence": "ephemeral", "sizeMb": 64 }
  ],
  "env": [
    { "name": "SESSION_SECRET",  "required": true,  "secret": true,  "generate": { "bytes": 32, "encoding": "base64url" } },
    { "name": "OPENAI_API_KEY",  "required": true,  "secret": true,  "source": "manual" },
    { "name": "OPENAI_BASE_URL", "required": false, "secret": false, "source": ".env.local" }
  ],
  "buildEnv": [
    { "name": "NEXT_PUBLIC_APP_URL", "from": "publicUrl" },
    { "name": "NEXT_PUBLIC_SITE_NAME", "source": ".env.local" }
  ],
  "backupBeforeDeploy": true
}
~~~

### 2.1 字段规则

平台在创建部署时校验，不符合时返回 `MANIFEST_INVALID`，`details.field` 指出字段。

| 字段 | 规则 |
|---|---|
| applicationId | 首次部署前为空，平台分配后 appcli 写回；格式 `^[a-z][a-z0-9-]{2,40}$` |
| containerPort | 1024–65535；应用监听 0.0.0.0 |
| healthcheckPath | 以 `/` 开头，仅 `[A-Za-z0-9/._-]`，≤128 字符；必须不经登录拦截和重定向，直接返回 2xx |
| healthTimeoutSeconds | 10–600，默认 120 |
| resources.memory | `^[0-9]{2,5}m$` 或 `^[0-9]{1,2}g$`，≤ 平台上限（默认 2g），默认 512m。超过套餐给每个项目的上限时不报错，按套餐上限运行（部署事件里有一行 `[plan]`） |
| resources.cpus | 0.25–平台上限（默认 2.0），默认 1.0。超过套餐上限时同上 |
| maxBodySize | `^[0-9]{1,4}m$`，≤ 平台上限（默认 500m），默认 50m |
| database.type | `sqlite`、`mysql`、`postgres` 或 `none`；不填视为 `none`。mysql/postgres 由平台运行数据库服务，见 [技术栈约定](stacks.md) |
| database.path | 仅 sqlite：必须位于 name 为 `database` 的 persistent 存储的 mountPath 之下，不含 `..` |
| database.version | 仅 mysql（`8.0`、`8.4`）/ postgres（`16`、`17`） |
| database.mode | 仅 mysql/postgres：`shared`（默认，共享实例中的独立库和账号）或 `dedicated`（独享数据库容器），见技术栈约定 |
| database.memory | 仅 mode 为 dedicated：数据库容器内存，默认 512m，不低于 256m |
| database.localPath | 本地项目内相对路径；sqlite 为数据库文件，mysql/postgres 为 SQL 导出文件；只在迁移本地数据时使用 |
| storage[].name | `^[a-z][a-z0-9-]{0,31}$`，不重复，最多 6 项 |
| storage[].mountPath | `^/app/[a-z0-9._/-]+$`，不含 `..`，互不嵌套 |
| storage[].persistence | `persistent` 或 `ephemeral`；ephemeral 须带 `sizeMb`，ephemeral 合计 ≤ 256 |
| storage[].localPath | 本地项目内相对路径，指向一个目录；只在迁移本地数据时使用；ephemeral 项不允许 |
| env[].name | `^[A-Z_][A-Z0-9_]{0,63}$`，不得是平台保留变量，不得以 `NEXT_PUBLIC_` 开头 |
| env[].source | 值的来源，三选一：本地配置文件的项目内相对路径（首次提交和补齐时读取）；`manual`（由用户自己用 `appcli config set` 输入）；或省略并使用 generate |
| env[].generate | 仅 secret 为 true 时可用，与 source 互斥：`{ "bytes": 16–64, "encoding": "base64url" 或 "hex" }`。平台缺少该值时由平台用安全随机数生成，明文不经过开发机和 AI |
| buildEnv[] | 构建时公开变量，见 2.3 |
| backupBeforeDeploy | 可选，默认 true：每次 deploy 和 rollback 前备份数据库（SQLite 文件或 MySQL/PostgreSQL 的 SQL 导出，保留最近 5 份）。项目级设置，由用户决定；单次部署可用 `--backup` / `--no-backup` 临时覆盖 |

database.type 为 sqlite 时，storage 中必须有 name 为 `database` 的 persistent 项；为 mysql/postgres 时，storage 中不能有名为 `database` 的项（留给数据库服务）。

### 2.2 平台保留变量

以下变量由平台在运行时注入，env 中不能声明（`RESERVED_ENV_NAME`）：

| 变量 | 值 | 注入条件 |
|---|---|---|
| PORT | containerPort | 始终 |
| HOSTNAME | `0.0.0.0` | 始终 |
| PUBLIC_URL | 访问地址，**不带末尾斜杠**：外网访问开启时为外网地址（如 `https://<项目ID>.<域名>`），否则为 `http://<服务器地址>:18001` | 始终 |
| DATABASE_URL | sqlite：`file:` + database.path；mysql/postgres：连接串（见技术栈约定） | database.type 为 sqlite、mysql 或 postgres |
| JDBC_DATABASE_URL、DB_HOST、DB_PORT、DB_NAME、DB_USER、DB_PASSWORD | 数据库服务的连接信息 | database.type 为 mysql 或 postgres |
| UPLOAD_DIR | name 为 `uploads` 的存储的 mountPath | 声明了 uploads |
| GENERATED_DIR | name 为 `generated` 的存储的 mountPath | 声明了 generated |

未满足注入条件的变量仍然保留，不得声明。

### 2.3 构建时变量 buildEnv

- 只用于必须在构建时确定、且可以公开的值（如 `NEXT_PUBLIC_*`）。不得包含密钥，不得与 env 重名。
- `from: "publicUrl"` 表示取平台分配的访问地址（不带末尾斜杠），由平台在构建时填入；`source` 表示从本地配置文件读取，由 appcli 随部署请求提交。二者必须且只能有一个。
- 构建时以 build-arg 传入；Dockerfile 构建阶段需声明 `ARG NAME` 和 `ENV NAME=$NAME`。
- 值会记录在部署记录中（非敏感），修改后必须重新部署才生效。

## 3. 状态

`appcli status --json` 中的项目状态：

| 值 | 含义 |
|---|---|
| created | 从未成功部署（包括首次部署失败） |
| running | 有当前版本在运行 |
| failed | 有过成功版本，但当前没有健康运行的版本（恢复上一版本也失败）；报告给用户，联系管理员 |
| sleeping | 休眠：平台把容器停了，数据、访问地址和历史版本都保留，仍占一个项目名额。`sleepReason` 为 `idle`（多天没有访问；有人访问或 `appcli wake` 即唤醒）或 `plan`（套餐装不下；续期或升级后自动唤醒） |
| deactivated | 已停用：容器停止、访问地址关闭；数据和地址保留 30 天，可请管理员恢复 |

部署状态：`build_queued`（等待构建）→ `building` → `queued`（等待服务器执行）→ `running` → `succeeded` / `failed` / `cancelled`。

- `lost`：执行中与服务器失联，结果暂时未知，不是终态。`--wait` 立即返回 `status: lost`（退出码 7），不要重新部署同一内容，稍后用 `appcli deployment <id> --wait` 查看；24 小时无结果转为 failed（`RESULT_UNKNOWN`）。lost 期间回滚、应用参数、恢复数据暂不可用。
- 同一项目同时只能有一个进行中的任务（`DUPLICATE_DEPLOYMENT`）。
- 构建在平台上排队进行，前面有其他构建时需要等待；套餐的构建优先级高的排在前面。
- `status` 还给出 `lastVisitAt`（最近一次有人访问的时间，平台没有记录访问时为 null）；休眠时另有 `sleepReason`、`asleepAt`，`externalState` 为 `asleep`。

部署输出中的阶段（`phase`），用于判断进行到哪一步：`config_sync`、`pack`、`data_export`、`upload`（本机）；`build`、`export`（平台构建）；`download`、`verify`、`validate`、`provision`、`load_image`、`prepare`（部署前备份或导入数据）、`start`、`health_check`、`proxy`（入口）、`finalize`、`restore_previous`（失败后恢复上一版本）、`stop`（停用、恢复数据时）。事件里 `plan` 阶段的一行是平台自己写的：这次按套餐的内存 / CPU 上限运行。

## 4. 运行参数

- `appcli config get --json` 返回 `version`（已保存版本）、`runningVersion`（线上版本）、`items`（每项 name、required、secret、isSet；敏感值不返回明文）、`missingRequired`。
- 普通部署时 appcli 自动补齐缺失的参数（已有值不变）：从 manifest 声明的本地文件读取，或由平台生成；`source: "manual"` 的参数需要用户自己执行 `appcli config set NAME`。
- `config set / unset / regenerate` 只保存新版本，不重启；`appcli config apply --wait` 才让线上生效（重建容器并健康检查，失败自动恢复）。版本冲突返回 `CONFIG_CONFLICT`，重新读取后再改。
- 详细约定见 [个人项目配置](personal-configuration.md)。

## 4.1 更新

appcli 和本技能都由平台提供，平台发布新版本后，已经装好的不会自己更新。`appcli version --json` 的 `updates` 说明哪一样落后了，以及更新它的命令：

~~~json
"updates": {
  "appcli": { "current": "0.1.2", "latest": "0.1.3", "outdated": true, "command": "npm install -g https://<平台地址>/downloads/appcli" },
  "skill": { "name": "code-agent-deploy", "state": "outdated", "outdated": true, "path": "<技能所在目录>", "command": "appcli skill install" }
}
~~~

- `outdated` 为 true 时才有 `command`，执行它即可；不要自己拼命令。
- 技能的 `state`：`current` 是最新；`outdated` 平台有新的；`unknown` 装着但没有版本记录（手动解压的，或由旧版 appcli 安装的）；`missing` 没有装在项目的 `.claude/skills/` 或用户目录的 `~/.claude/skills/` 下。后三种都算落后。
- 看的是 AI 工具会加载的那一份：项目里有就看项目里的（更新命令带 `--project`），否则看用户目录的。
- 平台没有给出这些信息时（较旧的平台，或连不上平台），`updates` 是空的，不做判断。

## 5. 命令与输出

~~~text
appcli version                                   appcli 与平台版本、features、有没有更新（updates）
appcli auth set-key [--platform <url>] | status | clear
appcli validate                                  校验 manifest（第 2.1 节规则）
appcli deploy [--import-data] [--backup | --no-backup] [--wait] [--wait-timeout <秒>]
appcli deployment <deploymentId> [--wait] [--wait-timeout <秒>]   查询或继续等待某次部署
appcli cancel <deploymentId>
appcli status
appcli logs [--tail n] [--since t] [--follow]
appcli deployments
appcli rollback --to <deploymentId> [--wait]
appcli config get | set <NAME> | unset <NAME> | regenerate <NAME> | apply [--wait]
appcli backups
appcli restore --backup <backupId> --confirm <applicationId> [--wait]
appcli restart [--wait]          # 原样重启线上版本（镜像、参数、数据不变），用于应用卡死等情况
appcli wake [--wait]             # 唤醒休眠的项目；没有在休眠时返回 asleep: false
appcli plan                      # 套餐、限额（limits，null 表示不限）和已用量（usage）
appcli access                    # 查看访问地址和外网访问状态
appcli access external on|off    # 开启/关闭外网访问（二级域名），立即生效
appcli access name <前缀>        # 修改外网域名前缀（3–63 位小写字母、数字、连字符）；先启用新前缀再释放旧前缀
appcli delete --confirm <applicationId> [--wait]
appcli console
appcli skill install [--project]
~~~

- 命令在项目根目录执行，从 deploy.manifest.json 读取 applicationId。
- `--wait-timeout` 默认 1800 秒。等待超时时任务仍在执行，返回 `WAIT_TIMEOUT`，用 `appcli deployment <id> --wait` 继续等待。
- deploy 创建任务后立即把 deploymentId 写入 `.appcli/state.json`，并在标准错误输出一行 `deploymentId=dep_...`。
- deploy 遇到休眠的项目会先唤醒它并等它起来，再继续；唤醒失败时返回那次唤醒任务的结果（`stage: "wake"`）。
- `appcli plan --json` 的输出：

~~~json
{
  "ok": true,
  "command": "plan",
  "plan": { "id": "plan_free", "name": "免费版", "expiresAt": null },
  "limits": { "projects": 1, "memoryMb": 256, "cpus": 0.25, "database": "none", "sleepAfterDays": 7, "versionsKept": 2, "dataMb": 500, "buildsPerDay": 10 },
  "usage": { "projects": 1, "asleep": 0, "buildsLast24h": 3 }
}
~~~

  `database`：`none` 只能用 SQLite，`shared` 可以用共享数据库实例，`dedicated` 共享和独享都可以。`versionsKept` 是可回滚的历史版本数。`dataMb` 是套餐写明的数据空间，平台目前不按它限制。
- `--import-data` 时在 `.appcli/state.json` 记录导入同意（绑定项目 ID）。之后只要项目 ID 相同、且项目还没有成功部署过，deploy 自动带上数据；首次成功后清除。项目 ID 不一致时该记录作废。

所有命令支持 `--json`：标准输出只输出一个 JSON 对象（`--follow` 为 JSON Lines），进度写标准错误。

~~~json
{
  "ok": false,
  "command": "deploy",
  "applicationId": "todo-app-k3f9",
  "deploymentId": "dep_8f2kq0xm3n7a1b2c",
  "status": "failed",
  "phase": "health_check",
  "publicUrl": "http://<服务器地址>:18001/",
  "restoredPrevious": true,
  "error": { "code": "HEALTHCHECK_FAILED", "category": "app", "retryable": false, "message": "no 2xx from /api/health within 120s", "details": {} },
  "result": { "...": "第 6 节" }
}
~~~

本地阶段失败时 `result` 为空，证据放在 `error.details`：构建失败为 `buildLogTail`（最后 200 行），参数缺失为 `missing`，数据导出失败为 `path` 和 `reason`。

退出码：0 成功；2 参数或 manifest 无效；3 认证失败；4 本地打包或导出失败；5 上传失败；6 部署失败（应用问题）；7 平台或服务器问题、超时、等待超时；1 其他未预期错误。

## 6. 部署结果

`result` 中供诊断的字段：

| 字段 | 含义 |
|---|---|
| status、phase、errorCode、message、details | 结果、失败所在阶段、错误码（第 7 节）、说明、附加信息 |
| restoredPrevious | true：访问地址仍在运行上一版本 |
| previousRestoreError | 不为空：上一版本也没能恢复，项目状态变为 failed |
| health | 健康检查：`path`、`lastStatus`、`lastLocation`（重定向目标）、`lastError`、`elapsedSeconds` |
| container | 容器 `state`、`exitCode`、`restartCount` |
| logTail | 应用最后的日志（已脱敏） |
| backupId | 部署前备份（`predeploy/...`）或恢复前备份（`pre-restore/...`） |
| dataImported | 是否导入了本地数据 |

## 7. 错误码

category 决定 AI 的处理方式：

| category | 处理 |
|---|---|
| app、build | 修改项目后重新部署，计入自动重试次数 |
| transient | 按说明处理，原样重试最多 1 次 |
| auth、local_env、user_input | 停下来，指导用户操作或向用户索取信息 |
| server、platform | 不修改项目、不反复重试；报告错误码和证据给用户，由平台管理员处理 |

| 错误码 | category | 说明 |
|---|---|---|
| PLATFORM_UNREACHABLE | local_env | 连不上平台地址 |
| DEPLOY_KEY_MISSING | auth | 未配置密钥，提示用户执行 `appcli auth set-key` |
| DEPLOY_KEY_INVALID | auth | 密钥无效或已吊销 |
| DEPLOY_KEY_EXPIRED | auth | 密钥过期，请用户在平台后台的“部署密钥”页面重新生成（没有开放注册的平台由管理员生成） |
| PERMISSION_DENIED | auth | 不是项目所有者 |
| CAPABILITY_UNSUPPORTED | platform | 平台不支持该功能 |
| PROJECT_QUOTA_EXCEEDED | platform | 项目数达到当前套餐的上限：请用户停用不再需要的项目，或在平台后台的“套餐”页面申请项目数更多的套餐 |
| APPLICATION_NOT_FOUND | user_input | manifest 中的 applicationId 不存在 |
| APPLICATION_DEACTIVATED | user_input | 项目已停用 |
| APPLICATION_ASLEEP | user_input | 项目在休眠：先 `appcli wake --wait`，再重试 |
| PLAN_LIMIT_EXCEEDED | platform | 套餐装不下这个项目：同时运行的项目数超出，或用了套餐不含的数据库服务。请用户在平台后台的“套餐”页面升级，或停用别的项目 |
| BUILD_QUOTA_EXCEEDED | platform | 24 小时内的构建次数用完；`details.retryAt` 之后可以再部署，`details.limit` 是次数 |
| APPLICATION_NOT_RUNNING | user_input | 项目没有当前版本，先成功部署一次 |
| PREVIOUS_TASK_UNRESOLVED | transient | 有结果未知（lost）的任务，稍后重试 |
| MANIFEST_INVALID | build | 字段不符合 2.1，`details.field` 指出字段 |
| RESOURCE_LIMIT_EXCEEDED | build | 申请资源超过平台上限 |
| RESERVED_ENV_NAME | build | 声明了平台保留变量 |
| CONFIG_MISSING_REQUIRED | user_input | 必填参数缺失，`details.missing`；其中需用户自己输入的在 `details.manual` |
| CONFIG_CONFLICT | transient | 参数版本冲突，重新读取后再改 |
| SOURCE_INVALID | build | 源码包不合法（打包失败、含不允许的文件、超过限制、Dockerfile 不存在等） |
| REGISTRY_UNREACHABLE | server | 构建时拉不到基础镜像；先检查镜像名、版本标签和镜像仓库是否可访问（见基础镜像约定），平台封装镜像也拉不到时报告管理员 |
| BUILD_FAILED | build | 构建失败，`details.buildLogTail` 为构建日志最后 200 行 |
| BUILD_TIMEOUT | build | 构建超过 30 分钟 |
| BUILD_INTERRUPTED | transient | 构建被取消或中断，重新部署即可 |
| BUILDER_UNAVAILABLE | server | 构建服务暂不可用 |
| DATA_EXPORT_FAILED | local_env | 本地数据快照或打包失败 |
| UPLOAD_TOO_LARGE | build | 包超过上限 |
| UPLOAD_FAILED | transient | 上传中断，可续传 |
| UPLOAD_EXPIRED | transient | 上传会话过期，重新上传 |
| ARTIFACT_CHECKSUM_MISMATCH | transient | 校验不一致，重新部署 |
| ARTIFACT_DOWNLOAD_FAILED | transient | 服务器获取部署包失败，重新部署 |
| DUPLICATE_DEPLOYMENT | transient | 已有进行中的任务，用 `appcli deployment` 等它结束 |
| DATA_IMPORT_NOT_ALLOWED | user_input | 项目已成功部署过，不能再导入本地数据 |
| AGENT_OFFLINE | server | 应用服务器离线 |
| AGENT_LOST | server | 执行中失联，结果暂时未知（lost），24 小时内可能被更正 |
| RESULT_UNKNOWN | server | 失联超过 24 小时仍无结果 |
| AGENT_RESTARTED、RUNNER_UNAVAILABLE、RUNNER_INTERRUPTED | server | 应用服务器上的执行组件不可用或中途重启，任务未完成或已按规则恢复 |
| TASK_INVALID | server | 服务器拒绝了任务 |
| PORT_IN_USE | transient | 首次部署前端口被占用；重新 deploy 1 次，仍失败需管理员处理（平台不会更换端口，访问地址不变） |
| PORT_CONFLICT | server | 已上线项目的端口被占用；访问地址不能变，需管理员处理 |
| PORT_POOL_EXHAUSTED | server | 端口已分配完 |
| DISK_SPACE_LOW | server | 服务器磁盘不足 |
| IMAGE_TAR_INVALID | build | 构建出的镜像不符合要求 |
| IMAGE_MISSING | server | 服务器上缺少要运行的镜像 |
| PLATFORM_MISMATCH | build | 镜像架构不是 linux/amd64 |
| DATA_ARCHIVE_INVALID | local_env | 本地数据包含不允许的文件类型或路径 |
| DATA_INTEGRITY_FAILED | user_input | 本地 SQLite 数据库完整性检查失败 |
| CONTAINER_START_FAILED | app | 容器退出，或以非 0 退出码反复重启，附退出码 |
| HEALTHCHECK_FAILED | app | 容器在运行，但健康接口未在时限内返回 2xx |
| PROXY_APPLY_FAILED | server | 访问入口配置失败 |
| DEPLOYMENT_TIMEOUT | server | 任务超时 |
| CANCELLED | platform | 任务已取消 |
| ROLLBACK_NOT_ALLOWED | platform | 目标版本不合法、其镜像已清理，或目标版本的数据库服务与项目当前的不同 |
| SUBDOMAIN_UNAVAILABLE | user_input | 域名前缀是保留名或已被占用；换一个前缀 |
| DATABASE_CHANGE_NOT_ALLOWED | user_input | 项目已上线后更换 mysql/postgres 的类型、版本或 mode，或去掉数据库；保持原设置，需要时请管理员处理 |
| BACKUP_NOT_FOUND | user_input | 备份不存在 |
| WAIT_TIMEOUT | transient | 本地等待超时，任务仍在执行 |

遇到 auth、server 类错误时，不得尝试任何绕过平台的途径。

## 8. 数据与备份

- 只有 persistent 存储会保留数据；ephemeral 存储是有大小上限的临时目录，重启即清空。开发者不能指定服务器上的存放位置。
- 发布、回滚、失败恢复都不改变数据。数据恢复只通过 `appcli restore` 进行。
- mysql/postgres 数据库服务的备份是 SQL 导出，恢复时整体替换数据库内容；本地迁移使用 SQL 导出文件（见技术栈约定）。
- 备份只有两种：部署前备份（按 backupBeforeDeploy，只含数据库，保留最近 5 份）和恢复前备份（restore 时被替换的数据，保留 14 天，可用来撤销那次恢复）。没有定时备份。restore 只替换备份中包含的存储，其余存储不动。
- 业务记录中保存附件的相对存储键，不保存绝对路径。
- 本地数据迁移：只在项目首次成功部署之前、用户同意时通过 `--import-data` 进行。appcli 对 `database.localPath` 生成一致性快照，打包 storage 中带 `localPath` 的目录（跳过符号链接并在结果中列出）。导入成功后平台删除数据包。

## 9. 访问入口

- 地址在项目创建时分配，此后不变（停用后由管理员恢复也不变）：
  - 访问地址 `externalUrl`：平台分配的二级域名（格式由平台决定，如 `https://<项目ID>.<域名>/`）。它是应用唯一的访问地址，关闭外网访问后应用无法访问。外网访问（`externalAccess`）默认开启，首次部署成功后生效，项目停用期间暂停；可用 `appcli access external off|on` 随时关闭或开启。`externalState`：`active` 已生效、`pending` 首次部署成功后生效、`binding` 正在生效、`releasing` 正在关闭、`off` 已关闭、`suspended` 项目停用中、`unavailable` 未开通。
  - `publicUrl`（即注入的 `PUBLIC_URL`）：始终是上面的访问地址。
- 应用运行在根路径 `/`，不做路径改写；用 `PUBLIC_URL` 生成绝对链接和回调地址。
- 部署成功表示：容器健康，且服务器本机经访问地址探测成功。服务器本机可达不代表访问者网络可达。
- 有登录功能的应用使用唯一 Cookie 名称。访问地址通常是 HTTPS（由平台网关终止）：Cookie 的 Secure 按请求头 `X-Forwarded-Proto` 决定或不设，不能强制。

## 10. 日志

平台保存的日志和部署结果已对常见凭据（Authorization、Cookie、password、token、secret、私钥、连接串密码、`dpk_` 开头的字符串）和本项目的敏感参数值脱敏。AI 仍不得在对话中复述疑似密钥。

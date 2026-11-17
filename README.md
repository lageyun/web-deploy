# WEB DEPLOY

**跟你的 AI 说一句话，把本地项目部署上线。**
**Tell your AI one sentence and your local project goes live.**

[平台首页 / Platform](https://console.lageyun.com/) · [完整说明 / Manual](https://console.lageyun.com/guide) · [简体中文](#简体中文) · [English](#english)

WEB DEPLOY 是对话式部署平台。这个仓库是它给 AI 用的部署技能（SKILL）：AI 按它把项目改造成可以部署的样子，再调用平台提供的命令行 `appcli` 完成部署。

WEB DEPLOY is a conversational deployment platform. This repository holds its deployment skill: the instructions an AI coding agent follows to make a project ready to deploy and then deploy it with `appcli`, the command line the platform provides.

---

## 简体中文

### 这是什么

在项目里打开 Claude Code、Codex、WorkBuddy 这样的 AI 编程工具，说一句“把这个项目部署到服务器”。安装工具、改造项目、打包、部署都由 AI 完成，完成后你会得到一个 HTTPS 访问地址，发给别人就能打开。

适用于能通过网址访问的项目：网站、Web 应用、后端接口服务。

- **电脑上不用装 Docker**：镜像在平台上构建。
- **不用登录服务器**：没有 SSH，没有服务器账号。
- **不用自己写部署脚本**：Dockerfile、健康检查、部署清单由 AI 按技能里的清单生成，改动先给你看。
- **失败了 AI 照着原因修**：平台返回错误码、分类和构建日志，AI 据此修改后重新部署。
- **访问地址自动分配**：每个项目一个 HTTPS 二级域名，部署后不变。
- **看日志、回滚、改参数，问一句就行**。
- **面向国内网络**：构建时的依赖下载走国内镜像源。

### 三步开始

1. 打开 [console.lageyun.com](https://console.lageyun.com/)，用手机号注册，在后台的“部署密钥”页面生成一个密钥。注册后默认是免费版，额度见平台的套餐页。
2. 在项目目录里打开 AI 编程工具，把下面这句话发给它：

   ```text
   把这个项目部署到服务器。部署平台是 https://console.lageyun.com 。如果还没有安装部署工具，先执行 npm install -g https://console.lageyun.com/downloads/appcli 和 appcli skill install，再打开安装命令输出的技能目录里的 SKILL.md，按它一步步操作。
   ```

3. AI 第一次部署时会请你在自己的终端里执行 `appcli auth set-key` 并粘贴密钥。之后它会把要对项目做的改动列给你确认。

整个过程你只需要做两件事：**输入一次部署密钥**，**确认 AI 提出的改动**。电脑上需要 Node.js 22 或更高版本。

### 发出去之后会发生什么

1. AI 识别项目：框架、启动方式、端口、数据库、上传目录、运行参数。
2. AI 做部署就绪改造（Dockerfile、`.dockerignore`、`deploy.manifest.json`、健康检查接口等），把完整的 diff 给你确认一次。
3. `appcli` 打包源码上传。`.env` 文件和 `node_modules` 一律不进源码包；本地数据库和上传的文件由 AI 写进 `.dockerignore` 排除。
4. 平台构建镜像并运行，依次经过：构建 → 导出 → 下载 → 校验 → 开通 → 加载 → 备份 → 启动 → 健康 → 入口 → 完成。
5. 成功后 AI 把访问地址交给你；失败时 AI 读错误码和日志，修改后重试，最多自动重试 3 次。

### 之后对 AI 怎么说

| 对 AI 说 | 它执行的命令 |
|---|---|
| 把这个项目部署到服务器 | `appcli deploy --wait` |
| 看看部署状态 | `appcli status` |
| 看看最近的日志 | `appcli logs --tail 200` |
| 看看运行参数，改完让它生效 | `appcli config get` / `appcli config apply` |
| 回滚到上一个版本 | `appcli rollback --to <部署 ID>` |
| 把数据恢复到上次部署之前 | `appcli backups` / `appcli restore` |
| 这个项目不用了，停用它 | `appcli delete --confirm <项目 ID>` |
| 打开后台 | `appcli console` |

### 支持的项目

- **Node.js**：Next.js、Vite、Express 等，仓库里带一个通过验收的 [Next.js + SQLite 示例项目](skill/code-agent-deploy/references/example-nextjs-sqlite/)。
- **Python**：gunicorn、uvicorn 启动的 Web 服务。
- **Java**：Spring Boot，或 WAR + Tomcat。
- **数据库**：默认 SQLite；MySQL 8.0 / 8.4 和 PostgreSQL 16 / 17 由平台提供，能不能用取决于套餐。
- **数据**：数据库和上传目录持久保存，部署和回滚都不会重置；可以在每次部署前自动备份数据库。
- 其他能用 Dockerfile 构建成 linux/amd64 镜像、通过 HTTP 提供服务的项目。

各技术栈的写法见 [技术栈约定](skill/code-agent-deploy/references/stacks.md) 和 [基础镜像约定](skill/code-agent-deploy/references/base-images.md)。

### 手动安装

不想让 AI 代装时：

```bash
npm install -g https://console.lageyun.com/downloads/appcli
appcli auth set-key      # 在自己的终端里粘贴部署密钥
appcli skill install     # 装到 ~/.claude/skills/code-agent-deploy/；加 --project 装到当前项目的 .claude/skills/
```

然后在项目目录里对 AI 说“把这个项目部署到服务器”。每一步的说明和常用命令见平台上的[完整说明](https://console.lageyun.com/guide)。

### 仓库里有什么

部署技能在 [`skill/code-agent-deploy/`](skill/code-agent-deploy/)，和 `appcli skill install` 装到你电脑上的是同一份：

| 文件 | 内容 |
|---|---|
| [`SKILL.md`](skill/code-agent-deploy/SKILL.md) | AI 的部署流程和不可违反的约束 |
| [`references/appcli-reference.md`](skill/code-agent-deploy/references/appcli-reference.md) | appcli 使用参考：命令、部署清单的字段、输出和错误码 |
| [`references/base-images.md`](skill/code-agent-deploy/references/base-images.md) | 基础镜像和依赖下载的约定 |
| [`references/stacks.md`](skill/code-agent-deploy/references/stacks.md) | Java、Python 和数据库服务的写法 |
| [`references/personal-configuration.md`](skill/code-agent-deploy/references/personal-configuration.md) | 运行参数的处理规则 |
| [`references/example-nextjs-sqlite/`](skill/code-agent-deploy/references/example-nextjs-sqlite/) | 通过验收的示例项目 |

命令行 `appcli` 和平台本身不在这个仓库里：`appcli` 从平台下载安装，平台是托管服务，在 [console.lageyun.com](https://console.lageyun.com/)。把技能公开，是为了让你在把项目交给 AI 之前，能看清楚它会按什么流程做、哪些事不许做。

### 密钥和数据怎么处理

- 部署密钥只保存在你自己的电脑上（`~/.appcli/credentials`）。技能禁止 AI 读取、打印或索要它，要由你自己在终端里输入。
- `.env` 文件不会被打包；运行参数只提交清单里声明的那几个，不提交整个文件。
- 本地数据默认不上传。只有在项目第一次部署成功之前、并且你明确同意时，才会迁移本地数据库和上传文件。
- 所有部署都经过平台：AI 不 SSH，不直连服务器，不操作远程 Docker。

### 反馈

使用中的问题和建议请在这个仓库提 [Issue](https://github.com/lageyun/web-deploy/issues)。

---

## English

### What it is

Open an AI coding agent such as Claude Code, Codex or WorkBuddy in your project and say "deploy this project to the server". The agent installs the tools, makes the project ready to deploy, packs the source and deploys it. When it is done you get an HTTPS address anyone can open.

It is for anything reached through a URL: websites, web applications, backend API services.

- **No Docker on your computer.** The image is built on the platform.
- **No server to log in to.** No SSH, no server account.
- **No deployment scripts to write.** The agent writes the Dockerfile, the health check and the deployment manifest from the skill's checklist, and shows you the changes first.
- **A failed deployment gets repaired.** The platform returns an error code, a category and the build log; the agent fixes the project from them and deploys again.
- **An address is assigned for you.** Each project gets an HTTPS subdomain that does not change between deployments.
- **Logs, rollbacks and settings are one question away.**
- **Built for networks in mainland China.** Dependencies are downloaded through mirrors there during the build.

### Get started

1. Open [console.lageyun.com](https://console.lageyun.com/), sign up and create a deploy key on the console's Deploy keys page. New accounts start on the free plan; its limits are on the platform's Plans page. Sign-up is by mobile number with an SMS code, and the console is in Chinese.
2. Open your AI coding agent in the project directory and send it this:

   ```text
   Deploy this project to the server. The deployment platform is https://console.lageyun.com . If the deploy tools are not installed yet, first run npm install -g https://console.lageyun.com/downloads/appcli and appcli skill install, then open SKILL.md in the skill directory the install command prints and follow it step by step.
   ```

3. On the first deployment the agent asks you to run `appcli auth set-key` in your own terminal and paste the key. After that it lists the changes it wants to make to the project for you to confirm.

You do two things in all: **type the deploy key once** and **confirm the changes the agent proposes**. Your computer needs Node.js 22 or later.

### What happens after you send it

1. The agent identifies the project: framework, start command, port, database, upload directories, runtime parameters.
2. It makes the project ready to deploy (Dockerfile, `.dockerignore`, `deploy.manifest.json`, a health check endpoint and so on) and shows you the whole diff once.
3. `appcli` packs the source and uploads it. `.env` files and `node_modules` never go into the package; local databases and uploaded files are excluded by the `.dockerignore` the agent writes.
4. The platform builds the image and runs it, stage by stage: build → export → download → verify → provision → load → backup → start → health → entry → done.
5. On success the agent hands you the address. On failure it reads the error code and the logs, changes the project and tries again, at most 3 times on its own.

### What to say afterwards

| Say to the agent | Command it runs |
|---|---|
| Deploy this project to the server | `appcli deploy --wait` |
| Show the deployment status | `appcli status` |
| Show the recent logs | `appcli logs --tail 200` |
| Show the runtime parameters, then apply my changes | `appcli config get` / `appcli config apply` |
| Roll back to the previous version | `appcli rollback --to <deployment ID>` |
| Restore the data from before the last deployment | `appcli backups` / `appcli restore` |
| I no longer need this project, deactivate it | `appcli delete --confirm <project ID>` |
| Open the console | `appcli console` |

### What can be deployed

- **Node.js**: Next.js, Vite, Express and others. The repository includes a [Next.js + SQLite example project](skill/code-agent-deploy/references/example-nextjs-sqlite/) that has passed acceptance on the platform.
- **Python**: web services started with gunicorn or uvicorn.
- **Java**: Spring Boot, or a WAR on Tomcat.
- **Databases**: SQLite by default; MySQL 8.0 / 8.4 and PostgreSQL 16 / 17 are provided by the platform, depending on your plan.
- **Data**: the database and the upload directories are persistent, and neither a deployment nor a rollback resets them. The database can be backed up automatically before every deployment.
- Any other project a Dockerfile can build into a linux/amd64 image that serves HTTP.

### Manual installation

If you would rather install the tools yourself:

```bash
npm install -g https://console.lageyun.com/downloads/appcli
appcli auth set-key      # paste your deploy key in your own terminal
appcli skill install     # into ~/.claude/skills/code-agent-deploy/; --project installs into this project's .claude/skills/
```

Then tell the agent in your project directory to deploy the project. Each step and the everyday commands are explained in the [manual](https://console.lageyun.com/guide) on the platform.

### What is in this repository

The deployment skill is in [`skill/code-agent-deploy/`](skill/code-agent-deploy/). It is the same copy `appcli skill install` puts on your computer:

| File | Contents |
|---|---|
| [`SKILL.md`](skill/code-agent-deploy/SKILL.md) | The agent's workflow and the rules it never breaks |
| [`references/appcli-reference.md`](skill/code-agent-deploy/references/appcli-reference.md) | The appcli reference: commands, manifest fields, output and error codes |
| [`references/base-images.md`](skill/code-agent-deploy/references/base-images.md) | Conventions for base images and dependency downloads |
| [`references/stacks.md`](skill/code-agent-deploy/references/stacks.md) | How Java, Python and the database services are set up |
| [`references/personal-configuration.md`](skill/code-agent-deploy/references/personal-configuration.md) | The rules for runtime parameters |
| [`references/example-nextjs-sqlite/`](skill/code-agent-deploy/references/example-nextjs-sqlite/) | An example project that has passed acceptance |

The `appcli` command line and the platform itself are not part of this repository: `appcli` is installed from the platform, and the platform is a hosted service at [console.lageyun.com](https://console.lageyun.com/). The skill is public so that, before you hand a project to an agent, you can see the steps it will follow and what it is not allowed to do.

### Keys and data

- The deploy key is stored only on your computer (`~/.appcli/credentials`). The skill forbids the agent to read, print or ask for it; you type it in your own terminal.
- `.env` files are never packed. Only the runtime parameters declared in the manifest are submitted, never a whole file.
- Local data is not uploaded by default. Your local database and uploaded files are migrated only before the project's first successful deployment, and only when you explicitly agree.
- Every deployment goes through the platform: the agent does not use SSH, connect to a server or drive a remote Docker.

### Feedback

Questions and suggestions are welcome as [issues](https://github.com/lageyun/web-deploy/issues) in this repository.

---

## License

[MIT](LICENSE)

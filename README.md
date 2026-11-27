# 拉格Skills（LageSkills）部署技能：让 Claude Code、Codex 等 AI 编程工具把本地项目部署上线

简体中文 | [English](README.en.md)

**跟你的 AI 说一句话，把本地项目部署上线。**

这个仓库是一个 **Agent Skill（AI 技能）**，技能名 `code-agent-deploy`。装上它之后，在 Claude Code、Codex、WorkBuddy 这样的 AI 编程工具里说一句“把这个项目部署到服务器”，AI 就按技能里的流程把项目改造成可以部署的样子，调用命令行 `appcli` 把源码交给 [拉格Skills](https://skills.lageyun.com/) 平台构建和运行，完成后给你一个 HTTPS 访问地址。电脑上不用装 Docker，不用登录服务器，不用自己写部署脚本。

[平台首页](https://skills.lageyun.com/) · [价格与套餐](https://skills.lageyun.com/pricing) · [按技术栈的教程](https://skills.lageyun.com/tutorials) · [完整说明](https://skills.lageyun.com/guide) · [技能本体 SKILL.md](skills/code-agent-deploy/SKILL.md) · [反馈](https://github.com/lageyun/web-deploy/issues)

## 一览

| | |
|---|---|
| 这是什么 | 给 AI 编程工具用的部署技能（Agent Skill）：一份 `SKILL.md`、几份参考文档和一个示例项目 |
| 技能名 | `code-agent-deploy` |
| 适用的 AI 工具 | Claude Code（自动加载技能）；Codex、WorkBuddy 等其他能执行命令的工具，让它读 `SKILL.md` 即可 |
| 能部署什么 | 能通过网址访问的项目：网站、Web 应用、后端接口服务 |
| 技术栈 | Node.js（Next.js、Vite、Express 等）、Python、Java（Spring Boot、WAR + Tomcat），以及其他能用 Dockerfile 构建的项目 |
| 数据库 | SQLite、MySQL 8.0 / 8.4、PostgreSQL 16 / 17 |
| 你要准备的 | Node.js 22 或更高版本，一个部署密钥（在平台注册后生成） |
| 不需要的 | Docker、服务器、SSH、域名、证书 |
| 部署结果 | 每个项目一个 HTTPS 二级域名，部署后不变 |
| 平台 | [skills.lageyun.com](https://skills.lageyun.com/)（控制台 console.lageyun.com），托管服务，面向国内网络 |
| 许可 | 技能以 MIT 许可开源 |

## 三步开始

1. 打开 [skills.lageyun.com](https://skills.lageyun.com/)，用手机号注册，在后台的“部署密钥”页面生成一个密钥。注册后默认是免费版，额度见平台的套餐页。
2. 在项目目录里打开 AI 编程工具，把下面这句话发给它：

   ```text
   把这个项目部署到服务器。部署平台是 https://console.lageyun.com 。如果还没有安装部署工具，先执行 npm install -g https://console.lageyun.com/downloads/appcli 和 appcli skill install，再打开安装命令输出的技能目录里的 SKILL.md，按它一步步操作。
   ```

3. AI 第一次部署时会请你在自己的终端里执行 `appcli auth set-key` 并粘贴密钥。之后它会把要对项目做的改动列给你确认。

整个过程你只需要做两件事：**输入一次部署密钥**，**确认 AI 提出的改动**。安装工具、改造项目、打包、部署都由 AI 完成。

## 你不用做的事

- **电脑上不用装 Docker**：镜像在平台上构建。
- **不用登录服务器**：没有 SSH，没有服务器账号。
- **不用自己写部署脚本**：Dockerfile、健康检查、部署清单由 AI 按技能里的清单生成，改动先给你看。
- **失败了 AI 照着原因修**：平台返回错误码、分类和构建日志，AI 据此修改后重新部署。
- **访问地址自动分配**：每个项目一个 HTTPS 二级域名，部署后不变。
- **看日志、回滚、改参数，问一句就行**。
- **面向国内网络**：构建时的依赖下载走国内镜像源。

## 这是一个 Agent Skill

Agent Skill 是给 AI 编程工具看的说明书：一个目录，里面有一份 `SKILL.md`（开头写着技能的名字和用途），加上它引用的参考文件。AI 在你提出相关的要求时读它，按它做事。这个仓库里的技能在 [`skills/code-agent-deploy/`](skills/code-agent-deploy/)：

| 文件 | 内容 |
|---|---|
| [`SKILL.md`](skills/code-agent-deploy/SKILL.md) | AI 的部署流程和不可违反的约束，以及什么时候该读下面哪份文档 |
| [`references/appcli-reference.md`](skills/code-agent-deploy/references/appcli-reference.md) | appcli 使用参考：命令、部署清单的字段、输出和错误码 |
| [`references/troubleshooting.md`](skills/code-agent-deploy/references/troubleshooting.md) | 部署失败时怎么排查：证据在哪、常见现象和原因、套餐限制类的错误 |
| [`references/operations.md`](skills/code-agent-deploy/references/operations.md) | 上线之后的操作：状态、日志、运行参数、休眠、公开访问、恢复数据、删除、回滚 |
| [`references/base-images.md`](skills/code-agent-deploy/references/base-images.md) | 基础镜像和依赖下载的约定 |
| [`references/stacks.md`](skills/code-agent-deploy/references/stacks.md) | Java、Python 和数据库服务的写法 |
| [`references/personal-configuration.md`](skills/code-agent-deploy/references/personal-configuration.md) | 运行参数的处理规则 |
| [`references/example-nextjs-sqlite/`](skills/code-agent-deploy/references/example-nextjs-sqlite/) | 通过验收的 Next.js + SQLite 示例项目 |

技能只是说明书，真正执行部署的是命令行 `appcli`。`appcli` 和平台本身不在这个仓库里：`appcli` 从平台下载安装，平台是托管服务。把技能公开，是为了让你在把项目交给 AI 之前，能看清楚它会按什么流程做、哪些事不许做。

### 安装技能

推荐让 `appcli` 来装，装的就是这个仓库里的这一份，以后平台发布新版本时 AI 会在部署前先更新它：

```bash
npm install -g https://console.lageyun.com/downloads/appcli
appcli auth set-key      # 在自己的终端里粘贴部署密钥
appcli skill install     # 装到 ~/.claude/skills/code-agent-deploy/；加 --project 装到当前项目的 .claude/skills/
```

用 Claude Code 的话，也可以把这个仓库当插件装（仍然要先装 `appcli` 并配置密钥），在 Claude Code 里输入：

```
/plugin marketplace add lageyun/web-deploy
/plugin install web-deploy@web-deploy
```

插件装好后技能名是 `web-deploy:code-agent-deploy`，说“把这个项目部署到服务器”就会用上；以后执行 `/plugin marketplace update web-deploy` 取新版本。

也可以直接从这个仓库复制（仍然要先装 `appcli` 并配置密钥）：

```bash
git clone https://github.com/lageyun/web-deploy.git
mkdir -p ~/.claude/skills
cp -r web-deploy/skills/code-agent-deploy ~/.claude/skills/
```

装好后重新打开 AI 编程工具的会话，在项目目录里说“把这个项目部署到服务器”。Claude Code 会自动加载 `~/.claude/skills/` 里的技能；其他工具不会自动加载，在这句话后面加一句“按 ~/.claude/skills/code-agent-deploy/SKILL.md 操作”。每一步的说明见平台上的[完整说明](https://skills.lageyun.com/guide)。

## 发出去之后会发生什么

1. AI 识别项目：框架、启动方式、端口、数据库、上传目录、运行参数。
2. AI 做部署就绪改造（Dockerfile、`.dockerignore`、`deploy.manifest.json`、健康检查接口等），把完整的 diff 给你确认一次。
3. `appcli` 打包源码上传。`.env` 文件和 `node_modules` 一律不进源码包；本地数据库和上传的文件由 AI 写进 `.dockerignore` 排除。
4. 平台构建镜像并运行，依次经过：构建 → 导出 → 下载 → 校验 → 开通 → 加载 → 备份 → 启动 → 健康 → 入口 → 完成。
5. 成功后 AI 把访问地址交给你；失败时 AI 读错误码和日志，修改后重试，最多自动重试 3 次。

## 之后对 AI 怎么说

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

## 支持的项目

- **Node.js**：Next.js、Vite、Express 等，仓库里带一个通过验收的 [Next.js + SQLite 示例项目](skills/code-agent-deploy/references/example-nextjs-sqlite/)。
- **Python**：gunicorn、uvicorn 启动的 Web 服务。
- **Java**：Spring Boot，或 WAR + Tomcat。
- **数据库**：默认 SQLite；MySQL 8.0 / 8.4 和 PostgreSQL 16 / 17 由平台提供，能不能用取决于套餐。
- **数据**：数据库和上传目录持久保存，部署和回滚都不会重置；可以在每次部署前自动备份数据库。
- 其他能用 Dockerfile 构建成 linux/amd64 镜像、通过 HTTP 提供服务的项目。

各技术栈的写法见 [技术栈约定](skills/code-agent-deploy/references/stacks.md) 和 [基础镜像约定](skills/code-agent-deploy/references/base-images.md)。

## 密钥和数据怎么处理

- 部署密钥只保存在你自己的电脑上（`~/.appcli/credentials`）。技能禁止 AI 读取、打印或索要它，要由你自己在终端里输入。
- `.env` 文件不会被打包；运行参数只提交清单里声明的那几个，不提交整个文件。
- 本地数据默认不上传。只有在项目第一次部署成功之前、并且你明确同意时，才会迁移本地数据库和上传文件。
- 所有部署都经过平台：AI 不 SSH，不直连服务器，不操作远程 Docker。

## 常见问题

### 怎么让 Claude Code 或 Codex 把我的项目部署上线？

在 [skills.lageyun.com](https://skills.lageyun.com/) 注册并生成部署密钥，然后在项目目录里把“三步开始”里的那句话发给 AI。AI 会自己安装 `appcli` 和这个技能，改造项目，部署，最后把访问地址交给你。

### 电脑上需要装 Docker 吗？

不需要。`appcli` 只打包源码，镜像在平台的服务器上构建。电脑上只要有 Node.js 22 或更高版本。

### 需要自己有服务器、域名或证书吗？

不需要。项目运行在平台上，平台为每个项目分配一个 HTTPS 二级域名，证书由平台处理。域名的前缀默认是项目 ID，可以让 AI 改成别的。

### 项目里没有 Dockerfile 可以吗？

可以。AI 按技能里的清单生成 Dockerfile、`.dockerignore`、部署清单 `deploy.manifest.json` 和健康检查接口，把完整的改动给你确认之后才部署。改造之后，本地的 `npm run dev` 仍然照常运行。

### 部署失败了怎么办？

平台返回错误码、错误分类和构建或运行日志。属于项目本身的问题，AI 说明依据、修改后重新部署，最多自动重试 3 次；属于账号、套餐或平台的问题，AI 会停下来告诉你该做什么，不会绕过去。新版本没能启动而平台恢复了上一个版本时，访问地址仍由上一个版本提供服务，AI 会告诉你。

### 重新部署或回滚，数据会丢吗？

不会。数据库和上传目录是持久保存的，部署和回滚都不重置。可以让平台在每次部署和回滚之前先备份数据库，保留最近 5 份，出问题时可以恢复。

### AI 会看到我的部署密钥和 `.env` 里的值吗？

技能禁止 AI 读取、打印或索要部署密钥，密钥由你自己在终端里输入。`.env` 文件不进源码包；AI 只读其中变量的名字，线上的运行参数只提交部署清单里声明的那几个。

### 是免费的吗？

注册后默认是免费版，可以直接部署。免费版的额度和其他套餐在登录后的“套餐”页面。

### 在国内网络下能用吗？

可以，平台就是面向国内网络做的：构建时 npm 包和二进制依赖都走国内镜像源，技能里也写明了遇到只能从境外下载的依赖（例如 Google 字体）时该怎么改。

### 这个技能、`appcli` 和拉格Skills 平台是什么关系？

技能是给 AI 看的说明书（这个仓库）；`appcli` 是 AI 调用的命令行，负责打包、上传和查询；平台负责构建镜像、运行项目和分配访问地址。三者一起用，缺一不可。

### 怎么更新技能？

不用管。平台发布新的 `appcli` 或技能后，AI 在下一次部署前会发现并先更新；也可以随时重新执行 `appcli skill install`。

## 反馈

使用中的问题和建议请在这个仓库提 [Issue](https://github.com/lageyun/web-deploy/issues)。

## 许可

[MIT](LICENSE)

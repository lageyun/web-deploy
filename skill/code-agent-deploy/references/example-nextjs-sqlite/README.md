# 示例：Next.js + SQLite（已在平台上验收通过）

按部署就绪改造清单写好的最小项目，改造其他项目时照此对照：

| 文件 | 要点 |
|---|---|
| `Dockerfile` | 多阶段；构建和运行阶段都用内部 node-base 摘要；`npm ci` 前复制 `.npmrc`；声明 `ARG NEXT_PUBLIC_APP_URL`；运行阶段 `USER 10001`，`CMD ["node", "server.js"]` |
| `.npmrc` | npmmirror 和 better-sqlite3 二进制镜像 |
| `.dockerignore` | 排除 node_modules、.next、.env*、本地 data 目录 |
| `next.config.mjs` | `output: 'standalone'` |
| `src/lib/db.ts` | 数据库路径读 `DATABASE_URL`，本地默认 `./data/app.db` |
| `src/app/api/health/route.ts` | 健康检查：只读数据库检查，不含业务逻辑 |
| `deploy.manifest.json` | sqlite 存储、`.next/cache` 临时存储、`SESSION_SECRET` 由平台生成、`NEXT_PUBLIC_APP_URL` 取访问地址 |

注意：
- better-sqlite3 固定 12.x（12.11.1）：npmmirror 上有 Node 24 预编译文件，13.x 没有，会构建失败。
- `package-lock.json` 未包含在此模板中，项目里要用 `npm install` 生成并提交（`npm ci` 需要它）。

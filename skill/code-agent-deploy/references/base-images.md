# 基础镜像与依赖下载约定

## 构建位置

镜像在部署平台上构建，开发者电脑不需要安装或启动 Docker。

## 选择基础镜像

Dockerfile 的 `FROM` 可以使用：

1. **平台封装的基础镜像**：直接写名称，不写仓库地址、标签或摘要；平台构建时替换为它维护的镜像，通常拉取更快、更稳定。有对应版本时优先使用。

   | 名称 | 内容 |
   |---|---|
   | `node-base` | Node.js 24.22.1、npm 11.19.1、Debian 12 slim；不含编译工具和 curl/wget |
   | `node-20`、`node-22` | Node.js 20 / 22，Debian 12 slim |
   | `python-3.11`、`python-3.12` | Python 3.11 / 3.12，Debian 12 slim |
   | `java-17-jdk`、`java-21-jdk` | Eclipse Temurin JDK 17 / 21（构建阶段） |
   | `java-17-jre`、`java-21-jre` | Eclipse Temurin JRE 17 / 21（运行阶段） |
   | `maven-3.9-java-17`、`maven-3.9-java-21` | Maven 3.9 + JDK（构建阶段） |
   | `gradle-8-java-21` | Gradle 8 + JDK 21（构建阶段） |
   | `tomcat-10.1-java-21` | Tomcat 10.1 + JDK 21（WAR 部署，见技术栈约定） |

   全部为 linux/amd64。MySQL、PostgreSQL 不作为基础镜像使用，见 [技术栈约定](stacks.md) 的数据库服务。

2. **其他公共镜像**：例如 `node:22-bookworm-slim`、`python:3.12-slim`、`nginx:1.27-alpine`。Docker Hub 上的镜像按常规写法即可（平台经加速站拉取）；尽量写明确的版本标签，不用 `latest`。其他镜像仓库（ghcr.io、quay.io 等）不保证能访问，拉取失败时向用户报告。

项目已有的 Node/Python 版本约束优先，不为迁就平台擅自升级或降级。

## 在基础镜像上安装、升级、覆盖

可以在任何基础镜像上安装系统包、升级运行时或工具、覆盖镜像里的文件，例如原生模块需要的编译工具：

~~~dockerfile
FROM node-base AS build
RUN sed -i 's#deb.debian.org#mirrors.aliyun.com#g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
~~~

- Debian/Ubuntu 系镜像使用 apt 前先把源换成 `mirrors.aliyun.com`（官方源从平台下载很慢，会拖到构建超时）；Alpine 用 `sed -i 's#dl-cdn.alpinelinux.org#mirrors.aliyun.com#g' /etc/apk/repositories`。
- 编译工具只放在构建阶段，运行阶段保持精简（多阶段构建，只复制产物）。
- 可以用 `npm install -g npm@<版本>` 等方式升级工具，注意与锁文件兼容。

## 运行阶段的约束（任何镜像都适用）

服务器按固定方式运行容器，镜像必须满足：

- 以用户 10001:10001 运行（Dockerfile 运行阶段写 `USER 10001`）；应用不能依赖 root。镜像内需要读取的文件对该用户可读。
- 根文件系统只读：运行时只能写入 manifest 中声明的存储（persistent 或 ephemeral）。缓存目录（如 `/app/.next/cache`）需声明为 ephemeral。
- 不保留任何 Linux 特权能力，不能绑定 1024 以下端口（containerPort 为 1024–65535）。
- 架构为 linux/amd64。
- 健康检查由平台从外部探测，镜像内不需要 curl/wget。

## npm 镜像源

npm 依赖默认使用 npmmirror（`https://registry.npmmirror.com`），速度最快；完整写法见 [示例项目](example-nextjs-sqlite/)（`.npmrc`、`Dockerfile`）。

- 项目根目录新增 `.npmrc`（不含凭据）：`registry=https://registry.npmmirror.com`，并按实际依赖加上二进制镜像行（如 `better_sqlite3_binary_host=https://registry.npmmirror.com/-/binary/better-sqlite3`）。Dockerfile 构建阶段在 `npm ci` 前复制 `.npmrc`。
- 使用 Prisma 时构建阶段设置 `ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma`；不需要浏览器时设置 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。
- npm 7+ 的 package-lock.json 无需修改；yarn 1.x 需把 yarn.lock 中的 `registry.yarnpkg.com` 替换为 `registry.npmmirror.com`。
- 本地 `npm run dev` 不受影响：`.npmrc` 只改变下载源。
- 原生模块（如 better-sqlite3）：优先用有预编译文件的版本（better-sqlite3 12.11.1 已验证有 Node 24 预编译文件）；没有预编译文件时在构建阶段安装编译工具（见上节）从源码编译。

## 依赖下载边界

构建环境可以访问 npm 官方源、npmmirror、GitHub 和阿里云系统包源，但部分境外地址较慢。检查锁文件中的 resolved URL、安装脚本里的二进制下载、字体与构建时调用的外部 API；下载慢或超时时优先改用国内镜像。

## 停止条件与报告

拉取镜像失败、依赖下载失败或超时，报告具体错误和缺少的内容，不无限重试。交付时说明每个构建阶段使用的基础镜像。

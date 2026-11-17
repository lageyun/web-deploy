# 技术栈约定：Java、Python 与数据库服务

Node.js 项目见 [示例项目](example-nextjs-sqlite/)。其他技术栈按本文改造，通用要求（监听 `0.0.0.0:$PORT`、健康检查接口、只读根文件系统、`USER 10001`、存储声明）不变。基础镜像名称与运行约束见 [基础镜像约定](base-images.md)。

## 数据库服务（MySQL / PostgreSQL）

项目使用 MySQL 或 PostgreSQL 时，不要把数据库打进应用镜像，也不要连接开发机上的数据库：在 manifest 中声明，由平台提供数据库。

~~~json
"database": { "type": "mysql", "version": "8.4" }
~~~

- type / version：`mysql` 8.0、8.4；`postgres` 16、17。优先与本地开发用的大版本一致。
- mode：
  - `shared`（默认，不写即是）：平台在共享的数据库实例中为项目单独建一个库和账号，账号只能访问自己的库，与其他项目逻辑隔离。适合大多数项目，节省资源。
  - `dedicated`：项目独享一个数据库容器，可用 `memory` 设置内存（默认 512m，不低于 256m）。适合数据量大、访问压力大或对隔离要求高的项目。shared 模式下不能写 memory。
  - 用户没有特别要求时用 shared；需要 dedicated 时向用户说明理由并确认。
  - 能不能用由用户的套餐决定（`appcli plan --json` 的 `limits.database`）：`none` 时没有数据库服务，`shared` 时不能用 dedicated。超出时部署返回 `PLAN_LIMIT_EXCEEDED`。
- 数据库只在项目内部网络可达（主机名 `db`），不对外开放端口；数据持久保存，部署、回滚、重启都不丢失。
- 连接信息由平台注入应用，不要在 env 中声明这些名字，也不要把库名、用户名、密码写进代码或配置文件：

  | 变量 | MySQL | PostgreSQL |
  |---|---|---|
  | `DATABASE_URL` | `mysql://<用户>:<密码>@db:3306/<库名>` | `postgresql://<用户>:<密码>@db:5432/<库名>` |
  | `JDBC_DATABASE_URL` | `jdbc:mysql://db:3306/<库名>` | `jdbc:postgresql://db:5432/<库名>` |
  | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | `db` `3306` `<库名>` `<用户>` `<密码>` | `db` `5432` `<库名>` `<用户>` `<密码>` |

  库名和用户名由平台分配（shared 时每个项目不同，dedicated 时为 `app`），代码必须从变量读取。

- 应用账号只有自己库内的权限：不能建库、不能访问其他库、不能使用需要管理员权限的功能（MySQL 的 SUPER、FILE，PostgreSQL 的超级用户与非受信扩展）。PostgreSQL 只能使用受信扩展（如 pgcrypto、uuid-ossp、hstore、citext）。
- 字符集默认 utf8mb4（MySQL 服务端、库和应用连接都是 utf8mb4，排序规则 utf8mb4_0900_ai_ci；PostgreSQL 为 UTF8），中文和 emoji 无需额外配置；建表语句不要指定 latin1、utf8mb3 等其他字符集。
- 表结构由应用的迁移工具在启动时创建（Flyway、Liquibase、Prisma migrate、Alembic、Django migrate 等），数据库就绪后应用才会启动。
- 项目首次成功部署后不能再更换数据库类型、版本或 mode，也不能去掉数据库（`DATABASE_CHANGE_NOT_ALLOWED`）；需要时请管理员处理。不能回滚到数据库设置不同的旧版本。
- 部署前备份（backupBeforeDeploy）为数据库的 SQL 导出；`appcli restore` 用它整体替换数据库内容，替换前的数据自动保存为“恢复前”备份。
- 本地数据迁移（首次部署、用户同意时）：请用户在本机导出 SQL 文件，放在项目内，在 manifest 中写 `"localPath": "db-dump.sql"`，用 `--import-data` 部署。导出文件加入 .gitignore 和 .dockerignore。
  - MySQL：`mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF <库名> > db-dump.sql`
  - PostgreSQL：`pg_dump --no-owner --no-privileges <库名> > db-dump.sql`
  - 导出文件以项目账号身份导入到项目自己的库：不能包含 `CREATE DATABASE`、`USE`、`\connect` 等切换库的语句，也不能包含需要管理员权限的语句；视图、触发器、存储过程的 DEFINER 会改为项目账号。
- 本地开发保持原有配置：代码读取上述变量时，以本地原值为默认值。

## Java（Spring Boot）

~~~dockerfile
FROM maven-3.9-java-21 AS build
WORKDIR /src
COPY .mvn/settings.xml /root/.m2/settings.xml
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

FROM java-21-jre
WORKDIR /app
COPY --from=build /src/target/*.jar /app/app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -Djava.io.tmpdir=/tmp"
USER 10001
CMD ["java", "-jar", "/app/app.jar"]
~~~

- Maven 依赖走阿里云：项目内 `.mvn/settings.xml` 配置 mirror `https://maven.aliyun.com/repository/public`（`mirrorOf` 为 `*`）。Gradle 用 `gradle-8-java-21` 构建，在 `settings.gradle` 的 `pluginManagement` 与 `dependencyResolutionManagement` 中把阿里云仓库放在最前。
- `application.properties`：`server.port=${PORT:8080}`；使用数据库服务时 `spring.datasource.url=${JDBC_DATABASE_URL:<本地原值>}`、`spring.datasource.username=${DB_USER:<本地原值>}`、`spring.datasource.password=${DB_PASSWORD:<本地原值>}`。
- 健康检查：有 Actuator 时 healthcheckPath 用 `/actuator/health`，否则加一个返回 200 的简单接口；都不能被 Spring Security 拦截。
- JVM 版本跟随项目的 `java.version` / `release` 设置选 17 或 21。containerPort 与 `server.port` 默认值一致（通常 8080）；resources.memory 建议至少 512m。
- 应用写文件只能写声明的存储或 `/tmp`；上传目录读 `UPLOAD_DIR`。

## Java（WAR + Tomcat）

使用 `tomcat-10.1-java-21`（Jakarta EE 10；javax.* 的老项目需要 Tomcat 9，平台未封装时请管理员提供）。Tomcat 默认写自身安装目录，只读根文件系统下要把工作目录放到 `/app`：

~~~dockerfile
FROM tomcat-10.1-java-21
ENV CATALINA_BASE=/app/tomcat
RUN mkdir -p /app/tomcat/webapps && cp -r /usr/local/tomcat/conf /app/tomcat/conf
COPY target/app.war /app/tomcat/webapps/ROOT.war
USER 10001
~~~

manifest 中把 `/app/tomcat/logs`、`/app/tomcat/temp`、`/app/tomcat/work` 声明为 ephemeral 存储；WAR 需展开时，在构建阶段解压到 `/app/tomcat/webapps/ROOT/`（运行时 webapps 只读）。

## Python

~~~dockerfile
FROM python-3.12 AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER 10001
CMD ["sh", "-c", "gunicorn -b 0.0.0.0:${PORT} app:app"]
~~~

- pip 走阿里云镜像（`PIP_INDEX_URL`）。需要编译的依赖在构建阶段装 `gcc` 等（先换 apt 源，见基础镜像约定），运行阶段只复制安装结果，或使用 manylinux 预编译 wheel。
- 连接 MySQL 8.x 时：PyMySQL 需要同时安装 `cryptography`（MySQL 8 默认的 caching_sha2_password 认证需要它，缺少时连接报错 `'cryptography' package is required`）；mysqlclient 不需要。
- Web 服务用生产服务器（gunicorn、uvicorn），监听 `0.0.0.0:$PORT`，不要用框架自带的开发服务器。
- Django：`ALLOWED_HOSTS` 包含访问地址的主机；`DATABASES` 用 `dj-database-url` 读 `DATABASE_URL`；静态文件在构建阶段 `collectstatic`，用 WhiteNoise 提供；`python manage.py migrate` 放在启动命令里先执行。
- 只读根文件系统下 Python 不能写 `__pycache__`（已用 `PYTHONDONTWRITEBYTECODE=1` 关闭）；缓存或临时文件写 `/tmp` 或声明的存储。

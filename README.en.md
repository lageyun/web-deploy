# WEB DEPLOY: an Agent Skill that lets Claude Code, Codex and other AI coding agents deploy your project

[简体中文](README.md) | English

**Tell your AI one sentence and your local project goes live.**

This repository is an **Agent Skill** named `code-agent-deploy`. With it installed, you say "deploy this project to the server" to an AI coding agent such as Claude Code, Codex or WorkBuddy. The agent follows the skill to make the project ready to deploy, hands the source to the [WEB DEPLOY](https://deploy.lageyun.com/) platform through the `appcli` command line, and gives you an HTTPS address when it is running. No Docker on your computer, no server to log in to, no deployment scripts to write.

[Platform](https://deploy.lageyun.com/) · [Pricing](https://deploy.lageyun.com/pricing) · [Tutorials](https://deploy.lageyun.com/tutorials) · [Manual](https://deploy.lageyun.com/guide) · [The skill: SKILL.md](skills/code-agent-deploy/SKILL.md) · [Feedback](https://github.com/lageyun/web-deploy/issues)

## At a glance

| | |
|---|---|
| What it is | A deployment skill (Agent Skill) for AI coding agents: a `SKILL.md`, reference documents and an example project |
| Skill name | `code-agent-deploy` |
| Works with | Claude Code (loads skills by itself); Codex, WorkBuddy and other agents that can run commands, when told to read `SKILL.md` |
| What it deploys | Anything reached through a URL: websites, web applications, backend API services |
| Stacks | Node.js (Next.js, Vite, Express and others), Python, Java (Spring Boot, WAR on Tomcat), and any other project a Dockerfile can build |
| Databases | SQLite, MySQL 8.0 / 8.4, PostgreSQL 16 / 17 |
| What you need | Node.js 22 or later, and a deploy key (created after signing up on the platform) |
| What you do not need | Docker, a server, SSH, a domain, a certificate |
| What you get | An HTTPS subdomain per project that does not change between deployments |
| Platform | [deploy.lageyun.com](https://deploy.lageyun.com/) (console at console.lageyun.com), a hosted service built for networks in mainland China; the console is in Chinese |
| License | The skill is open source under MIT |

## Get started

1. Open [deploy.lageyun.com](https://deploy.lageyun.com/), sign up and create a deploy key on the console's Deploy keys page. New accounts start on the free plan; its limits are on the platform's Plans page. Sign-up is by mobile number with an SMS code, and the console is in Chinese.
2. Open your AI coding agent in the project directory and send it this:

   ```text
   Deploy this project to the server. The deployment platform is https://console.lageyun.com . If the deploy tools are not installed yet, first run npm install -g https://console.lageyun.com/downloads/appcli and appcli skill install, then open SKILL.md in the skill directory the install command prints and follow it step by step.
   ```

3. On the first deployment the agent asks you to run `appcli auth set-key` in your own terminal and paste the key. After that it lists the changes it wants to make to the project for you to confirm.

You do two things in all: **type the deploy key once** and **confirm the changes the agent proposes**. Installing the tools, preparing the project, packing and deploying are done by the agent.

## What you do not have to do

- **No Docker on your computer.** The image is built on the platform.
- **No server to log in to.** No SSH, no server account.
- **No deployment scripts to write.** The agent writes the Dockerfile, the health check and the deployment manifest from the skill's checklist, and shows you the changes first.
- **A failed deployment gets repaired.** The platform returns an error code, a category and the build log; the agent fixes the project from them and deploys again.
- **An address is assigned for you.** Each project gets an HTTPS subdomain that does not change between deployments.
- **Logs, rollbacks and settings are one question away.**
- **Built for networks in mainland China.** Dependencies are downloaded through mirrors there during the build.

## This is an Agent Skill

An Agent Skill is a set of instructions for an AI coding agent: a directory with a `SKILL.md` (which opens with the skill's name and what it is for) and the reference files it points to. The agent reads it when you ask for something it covers, and follows it. The skill in this repository is in [`skills/code-agent-deploy/`](skills/code-agent-deploy/):

| File | Contents |
|---|---|
| [`SKILL.md`](skills/code-agent-deploy/SKILL.md) | The agent's workflow and the rules it never breaks |
| [`references/appcli-reference.md`](skills/code-agent-deploy/references/appcli-reference.md) | The appcli reference: commands, manifest fields, output and error codes |
| [`references/base-images.md`](skills/code-agent-deploy/references/base-images.md) | Conventions for base images and dependency downloads |
| [`references/stacks.md`](skills/code-agent-deploy/references/stacks.md) | How Java, Python and the database services are set up |
| [`references/personal-configuration.md`](skills/code-agent-deploy/references/personal-configuration.md) | The rules for runtime parameters |
| [`references/example-nextjs-sqlite/`](skills/code-agent-deploy/references/example-nextjs-sqlite/) | A Next.js + SQLite example project that has passed acceptance |

The skill is only the instructions; the deploying is done by the `appcli` command line. `appcli` and the platform itself are not part of this repository: `appcli` is installed from the platform, and the platform is a hosted service. The skill is public so that, before you hand a project to an agent, you can see the steps it will follow and what it is not allowed to do.

### Installing the skill

Let `appcli` install it. What it installs is the copy in this repository, and when the platform publishes a new release the agent updates it before the next deployment:

```bash
npm install -g https://console.lageyun.com/downloads/appcli
appcli auth set-key      # paste your deploy key in your own terminal
appcli skill install     # into ~/.claude/skills/code-agent-deploy/; --project installs into this project's .claude/skills/
```

Or copy it from this repository (`appcli` and a deploy key are still needed):

```bash
git clone https://github.com/lageyun/web-deploy.git
mkdir -p ~/.claude/skills
cp -r web-deploy/skills/code-agent-deploy ~/.claude/skills/
```

Then start a new session in your AI coding agent and tell it, in the project directory, to deploy the project. Claude Code loads the skills in `~/.claude/skills/` by itself; other agents do not, so add "follow ~/.claude/skills/code-agent-deploy/SKILL.md" to the sentence. Each step is explained in the [manual](https://deploy.lageyun.com/guide) on the platform.

## What happens after you send it

1. The agent identifies the project: framework, start command, port, database, upload directories, runtime parameters.
2. It makes the project ready to deploy (Dockerfile, `.dockerignore`, `deploy.manifest.json`, a health check endpoint and so on) and shows you the whole diff once.
3. `appcli` packs the source and uploads it. `.env` files and `node_modules` never go into the package; local databases and uploaded files are excluded by the `.dockerignore` the agent writes.
4. The platform builds the image and runs it, stage by stage: build → export → download → verify → provision → load → backup → start → health → entry → done.
5. On success the agent hands you the address. On failure it reads the error code and the logs, changes the project and tries again, at most 3 times on its own.

## What to say afterwards

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

## What can be deployed

- **Node.js**: Next.js, Vite, Express and others. The repository includes a [Next.js + SQLite example project](skills/code-agent-deploy/references/example-nextjs-sqlite/) that has passed acceptance on the platform.
- **Python**: web services started with gunicorn or uvicorn.
- **Java**: Spring Boot, or a WAR on Tomcat.
- **Databases**: SQLite by default; MySQL 8.0 / 8.4 and PostgreSQL 16 / 17 are provided by the platform, depending on your plan.
- **Data**: the database and the upload directories are persistent, and neither a deployment nor a rollback resets them. The database can be backed up automatically before every deployment.
- Any other project a Dockerfile can build into a linux/amd64 image that serves HTTP.

How each stack is set up is in the [stack conventions](skills/code-agent-deploy/references/stacks.md) and the [base image conventions](skills/code-agent-deploy/references/base-images.md).

## Keys and data

- The deploy key is stored only on your computer (`~/.appcli/credentials`). The skill forbids the agent to read, print or ask for it; you type it in your own terminal.
- `.env` files are never packed. Only the runtime parameters declared in the manifest are submitted, never a whole file.
- Local data is not uploaded by default. Your local database and uploaded files are migrated only before the project's first successful deployment, and only when you explicitly agree.
- Every deployment goes through the platform: the agent does not use SSH, connect to a server or drive a remote Docker.

## FAQ

### How do I get Claude Code or Codex to deploy my project?

Sign up at [deploy.lageyun.com](https://deploy.lageyun.com/) and create a deploy key, then send the agent the sentence under "Get started" from your project directory. The agent installs `appcli` and this skill, prepares the project, deploys it and hands you the address.

### Do I need Docker on my computer?

No. `appcli` only packs the source; the image is built on the platform's server. Your computer needs Node.js 22 or later and nothing else.

### Do I need my own server, domain or certificate?

No. The project runs on the platform, which assigns each project an HTTPS subdomain and takes care of the certificate. The subdomain's prefix is the project ID by default, and you can ask the agent to change it.

### What if my project has no Dockerfile?

That is fine. The agent writes the Dockerfile, the `.dockerignore`, the deployment manifest `deploy.manifest.json` and a health check endpoint from the skill's checklist, and deploys only after you have confirmed the whole change. Afterwards your local `npm run dev` still behaves as before.

### What happens when a deployment fails?

The platform returns an error code, a category and the build or runtime log. When the problem is in the project, the agent says what its judgement rests on, changes the project and deploys again, at most 3 times on its own. When it is about your account, your plan or the platform, the agent stops and tells you what to do; it does not work around it. When a new version fails to start and the platform has restored the previous one, the address keeps serving the previous version and the agent tells you so.

### Will I lose data when I redeploy or roll back?

No. The database and the upload directories are persistent, and neither a deployment nor a rollback resets them. The platform can back the database up before every deployment and rollback, keeping the five most recent backups to restore from.

### Can the agent see my deploy key or the values in `.env`?

The skill forbids the agent to read, print or ask for the deploy key; you type it in your own terminal. `.env` files do not go into the source package. The agent reads only the names of the variables in them, and only the runtime parameters declared in the deployment manifest are submitted.

### Is it free?

New accounts start on the free plan and can deploy straight away. The free plan's limits and the other plans are on the Plans page after you sign in.

### Does it work on networks in mainland China?

Yes, that is what the platform is built for. During the build, npm packages and binary dependencies are downloaded through mirrors in mainland China, and the skill tells the agent what to change when a dependency can only be fetched from abroad (Google fonts, for example).

### How do the skill, `appcli` and the WEB DEPLOY platform fit together?

The skill is the instructions the agent reads (this repository). `appcli` is the command line the agent runs to pack, upload and query. The platform builds the image, runs the project and assigns its address. The three are used together.

### How do I update the skill?

You do not have to. When the platform publishes a new `appcli` or a new release of the skill, the agent notices before the next deployment and updates first. You can also run `appcli skill install` again at any time.

## Feedback

Questions and suggestions are welcome as [issues](https://github.com/lageyun/web-deploy/issues) in this repository.

## License

[MIT](LICENSE)

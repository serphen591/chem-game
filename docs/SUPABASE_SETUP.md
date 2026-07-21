# Supabase 上线配置

本仓库已经包含数据库迁移、RLS、Edge API、学生登录入口、班级系统和教师管理端。

## 当前生产部署状态（2026-07-21）

- Supabase Project Ref：`odcnrtafzcvirmzxzsfx`
- 项目 URL：`https://odcnrtafzcvirmzxzsfx.supabase.co`
- 数据库迁移：`202607210001`、`202607210002` 已部署
- 公开实验目录：323条已写入 `experiments`
- Edge Function：`chem-lab-api`，状态 `ACTIVE`，JWT 校验开启
- 未登录接口验证：返回 HTTP 401
- 学生网页：已配置 publishable key 和离线同步

publishable key 是 Supabase 明确设计为浏览器可见的低权限项目标识；真正的数据访问仍由学生JWT和数据库RLS决定。secret/service-role key未写入仓库。下面的步骤保留为重新部署、灾备恢复或新环境搭建说明。

## 1. 创建并绑定 Supabase 项目

在 Supabase Dashboard 创建一个项目，记录项目 URL、Project Ref 和 publishable key。publishable key 会出现在浏览器中，这是 Supabase 面向前端的公开密钥；数据库密码、service-role key 和 access token 不能写入仓库。

本机安装并登录 CLI 后执行：

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy chem-lab-api
```

首次使用前，应先检查 `db push --dry-run` 的结果。不要对正式项目运行 `supabase db reset --linked`。

## 2. 设置认证

在 Supabase Dashboard 的 Authentication 中：

1. 保持 Email/Password 登录开启。
2. Site URL 设置为 `https://serphen591.github.io/chem-game/`。
3. Redirect URLs 添加学生端和教师端地址。
4. 正式开放注册前启用验证码、邮件频率限制和密码策略。

学生注册时只要求“实验员昵称”，真实姓名和学号不是系统必填项。

## 3. 创建第一个教师账号

先通过学生端或 Supabase Authentication 创建账号，再只在 Supabase SQL Editor 中提升角色：

```sql
update public.profiles
set role = 'teacher'
where id = (
  select id from auth.users where email = '教师账号邮箱'
);
```

真实教师邮箱只出现在受保护的 Supabase 项目中，不要把执行后的 SQL、截图或数据导出提交到 GitHub。

## 4. 同步323条实验目录

实验目录已从 `index.html` 独立到 `data/experiments.json`。在本机临时环境变量中设置管理员密钥后执行同步：

```powershell
$env:SUPABASE_URL='https://YOUR_PROJECT_REF.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='仅在本机临时设置'
npm.cmd run sync:experiments
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

管理员密钥仅用于将公开实验目录写入 `experiments` 表，不参与学生网页运行。

## 5. 配置 GitHub Pages

当前生产站点可以继续使用原有的 `main / (root)` 分支发布。仓库中的 `config.js` 只包含 Supabase 浏览器公开配置，因此直接推送 `main` 就能让学生端连接后端。

如需改用 GitHub Actions 构建，在 GitHub 仓库的 `Settings → Secrets and variables → Actions → Variables` 添加：

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

随后在 `Settings → Pages` 中把 Source 改为 **GitHub Actions**，手动运行 `Deploy GitHub Pages` 工作流。`pages.yml` 会用变量覆盖仓库中的公开配置，不会把数据库密码或管理员密钥打包进网页。

## 6. 配置 Supabase 自动部署

若希望修改迁移或 Edge Function 后自动发布，在 GitHub Environment `supabase-production` 中添加以下 Secrets：

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

建议为该 Environment 开启人工审批。上述值只存在于 GitHub Secrets，不应出现在代码、Actions 日志或 README 中。

## 7. 验证

```powershell
npm.cmd run check
npm.cmd run build
```

上线后完成一次最小闭环：

1. 教师账号创建班级并取得邀请码。
2. 学生注册、登录并加入班级。
3. 学生在某一步分别制造1次、2次、3次错误。
4. 教师端确认对应标签显示绿、橙、红。
5. 第三次错误的实验出现在“待重做建议”中。
6. 在线完成实验，确认完成页由“正在实时同步”变为“已实时同步”，教师端随即出现实验记录和关键回放。
7. 断网完成实验，确认学生端关键回放标记为“本机待同步”；恢复网络后确认离线队列自动补传且事件不重复。

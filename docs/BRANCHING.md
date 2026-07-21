# Git 分支与发布规则

## `main`：生产分支

`main` 始终代表可以向学生公开使用的版本。当前 GitHub Pages 直接从 `main / (root)` 发布，因此合并或推送到 `main` 后，公开网页会随之更新。

适合进入 `main` 的内容：

- 已完成并通过检查的功能；
- 数据库迁移和对应前端代码已兼容；
- 不包含学生数据、数据库密码、secret/service-role key、SSH 私钥；
- `npm run check` 与 `npm run build` 均通过。

## 其他分支：开发和试验

建议命名：

- `feature/student-login`：新功能；
- `feature/3d-apparatus`：较大的视觉或模型升级；
- `fix/gas-animation`：普通问题修复；
- `hotfix/login-blocked`：线上紧急修复；
- `release/v8`：需要集中验收的大版本。

典型流程：

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/功能名称

# 修改并验证
npm.cmd run check
npm.cmd run build

git add --all
git commit -m "feat: 功能说明"
git push -u origin feature/功能名称
```

随后在 GitHub 创建 Pull Request，确认无敏感文件、检查通过后再合并到 `main`。

## 数据库迁移规则

- 已经推送到远端的迁移文件不能改写，应创建新的时间戳迁移；
- 功能分支的前端代码必须兼容当前生产数据库；
- 破坏性字段删除至少分两次发布：先停止使用，再在后续版本删除；
- 正式项目禁止运行 `supabase db reset --linked`；
- Edge Function 可先部署兼容版本，再合并调用它的前端代码。

## 本次上线

本次内容是一个完整后端发布，数据库与 Edge API 已先部署并验证，随后直接把经过检查的代码推送到 `main`。以后3D模型、动画和移动端适配建议分别使用独立的 `feature/...` 分支开发。


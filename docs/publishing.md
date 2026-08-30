# 发布 Goland Style 到 VS Code Marketplace

## 一次性准备

1. 在 [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers/) 登录 Microsoft 账号，创建 Publisher。
2. Publisher 的 **ID** 必须唯一且发布后不能修改。当前项目中的 `package.json` 使用 `jetbrains-style-go`；如果你创建的是其他 ID，请同步修改 `package.json` 的 `publisher`，以及 `profile/extensions.json` 和 `profile/extensions-full.json` 中的扩展 ID 前缀。
3. 在 GitHub 创建公开仓库并推送本项目。拿到仓库 URL 后，再把它填入 `package.json` 的 `repository`、`bugs` 和 `homepage` 字段，Marketplace 页面会正确链接源码和问题反馈。

## 本机手动发布

在项目根目录 PowerShell 执行：

```powershell
npm ci
npx vsce login jetbrains-style-go
# 按提示粘贴 Azure DevOps Personal Access Token
npm run publish
```

PAT 至少需要 `Marketplace (Manage)` 权限，组织范围选择 **All accessible organizations**。不要把 PAT 写入仓库、README、批处理文件或 `package.json`；`vsce login` 会将凭据保存到本机凭据存储。

如果只想手动上传已经生成的包：

```powershell
& '.\Goland Style.bat'
npx vsce publish --packagePath .\dist\Goland-Style.vsix --allow-missing-repository --no-yarn
```

也可以打开 Publisher Management 页面，选择 Publisher 后使用 **Add extension** 上传 `dist/Goland-Style.vsix`。

## GitHub Actions 自动发布

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 新建一个名为 `VSCE_PAT` 的 Secret，然后推送版本 Tag：

```powershell
git tag v0.2.5
git push origin v0.2.5
```

仓库中的 `marketplace.yml` 会先运行测试和打包，再将 `Goland-Style.vsix` 发布到 Marketplace。GitHub Release 仍由 `release.yml` 单独创建。

## 发布前检查

```powershell
npm test
npx vsce package --allow-missing-repository --out .\dist\Goland-Style.vsix
npx vsce ls --no-yarn
```

请确认 `package.json` 的 `displayName` 为 `Goland Style`、版本号遵循 SemVer、README/CHANGELOG/许可证存在，且扩展中没有密钥或私人文件。Marketplace 会扫描新上传包中的敏感信息。

## 认证方式说明

Microsoft 官方目前推荐使用 Microsoft Entra ID 的安全自动化认证；Azure DevOps 全局 PAT 计划于 2026 年 12 月 1 日退休。个人首次发布可以先按上面的 `vsce login` 流程操作，长期 CI 建议迁移到 Entra ID 工作负载身份联合。

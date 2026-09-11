# 下一站，讲台

16:9 横屏教师人生视觉小说。固定剧情与已生成语音可直接阅读；自由回答、实时语音和个性化结语需要玩家自己的阿里云百炼 API Key。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`，进入“设置”，填写以 `sk-` 开头的阿里云百炼（DashScope）API Key。

API Key 只保存在当前浏览器的 `localStorage`，不会写进游戏进度、源代码或 Git。项目仅接受阿里云百炼 API Key；不要提交 `.dev.vars`、`.env` 或任何真实密钥。

## 桌面安装包

GitHub Releases 提供 macOS 与 Windows 安装包。安装后双击即可运行，不需要另装 Node.js 或浏览器插件。首次使用自由回答、实时语音或个性化结语时，在游戏“设置”中填写自己的阿里云百炼 API Key。

## 检查

```bash
npm test
npm run typecheck
npm run build
```

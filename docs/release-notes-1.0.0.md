# Relative Scroll Lock 1.0.0 · 滚动锁

左右两栏分别停在要对照的段落，点一下锁紧，就能从当前两个位置一起滚动。再次点击松开；按住 Alt 可临时单独调整一栏，松手后从新位置继续联动。

适合原文与整理稿、草稿与修订稿、原文与译文的对照。支持同一篇笔记的两个不同位置，以及阅读和编辑模式。它同步像素移动距离，不自动识别对应段落。

## 安装 / Installation

下载 `relative-scroll-lock-1.0.0.zip`，将其中的 `relative-scroll-lock` 文件夹放到知识库插件目录（默认 `.obsidian/plugins/`），重新加载 Obsidian，在第三方插件设置中启用。

Alternatively, download `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/relative-scroll-lock/`, reload Obsidian, and enable Relative Scroll Lock.

GitHub 自动生成的 `Source code` 压缩包不是安装包。完整操作说明和限制见 [README](https://github.com/v-49/obsidian-relative-scroll-lock#readme)。

## Scope

Desktop, Obsidian 1.13.7+, exactly two side-by-side Markdown panes. Tested on Windows. No default hotkey. Clicking Lock removes any native link between the two panes. No note content is read or modified; no network requests or telemetry.

已公开源码和安装包，尚未上架 Obsidian 社区插件库。

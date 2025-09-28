<h1 align="center">picgo-plugin-optimization </h1>
<p>
  <a href="https://www.npmjs.com/package/picgo-plugin-optimization" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/picgo-plugin-optimization.svg">
  </a>
  <a href="https://www.npmjs.com/package/picgo-plugin-optimization" target="_blank">
    <img alt="npm downloads" src="https://img.shields.io/npm/dt/picgo-plugin-optimization?label=npm%20downloads&color=yellow">
  </a>
  <img alt="Version" src="https://img.shields.io/github/package-json/v/CaoMeiYouRen/picgo-plugin-optimization.svg" />
  <a href="https://github.com/CaoMeiYouRen/picgo-plugin-optimization/actions?query=workflow%3ARelease" target="_blank">
    <img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/CaoMeiYouRen/picgo-plugin-optimization/release.yml?branch=master">
  </a>
  <img src="https://img.shields.io/node/v/picgo-plugin-optimization" />
  <a href="https://github.com/CaoMeiYouRen/picgo-plugin-optimization#readme" target="_blank">
    <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
  </a>
  <a href="https://github.com/CaoMeiYouRen/picgo-plugin-optimization/graphs/commit-activity" target="_blank">
    <img alt="Maintenance" src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" />
  </a>
  <a href="https://github.com/CaoMeiYouRen/picgo-plugin-optimization/blob/master/LICENSE" target="_blank">
    <img alt="License: MIT" src="https://img.shields.io/github/license/CaoMeiYouRen/picgo-plugin-optimization?color=yellow" />
  </a>
</p>

> 基于 sharp 的 PicGo 图片格式转换和压缩插件

## 🏠 主页

[https://github.com/CaoMeiYouRen/picgo-plugin-optimization#readme](https://github.com/CaoMeiYouRen/picgo-plugin-optimization#readme)

## 📦 依赖要求

-   node >=18

## 🚀 安装

```sh
npm install picgo-plugin-optimization
```

## 👨‍💻 使用

本插件是 **PicGo（CLI 或 GUI） 的 beforeUpload 插件**，用于在上传前对图片进行：

-   格式转换（可选）
-   有损/无损压缩（依赖 `sharp`）
-   按最大宽 / 高 等比缩放
-   若开启 `skipIfLarger`，会在压缩变大时自动回退原图

你可以在 3 种场景中使用：

1. PicGo GUI（图形界面）
2. PicGo CLI（全局安装/命令行）
3. Node.js 代码中以编程方式调用 PicGo

---

### 1⃣ PicGo GUI 使用

1. 打开 PicGo GUI -> 插件设置 -> 搜索并安装 `picgo-plugin-optimization`
2. 重启（或刷新）PicGo GUI
3. 到 设置 -> 上传前处理（beforeUpload）里勾选：`图片优化 (beforeUpload)`
4. 打开 插件配置，按需填写：
    - `format`：目标格式（留空保持原格式）
    - `quality`：质量（1-100，有损格式生效）
    - `maxWidth` / `maxHeight`：最大宽 / 高（0 表示不限制）
    - `skipIfLarger`：若优化后文件更大则回退
    - `enableLogging`：在 PicGo 日志面板输出详细调试信息
5. 之后正常拖拽或粘贴上传，即会自动优化。

在 GUI 里还提供一个“查看当前 json 配置”的菜单项，方便确认当前生效配置。

---

### 2⃣ PicGo CLI 使用

全局安装（示例）：

```bash
npm i -g picgo picgo-plugin-optimization
```

然后在你的 PicGo 配置文件（默认：`~/.picgo/config.json`）中加入（或通过 PicGo 提供的 `picgo set` / `picgo use` 等命令配置）：

```jsonc
{
    "picgo-plugin-optimization": {
        "format": "webp", // 留空或删除此字段则保持原格式
        "quality": 80, // 1-100
        "maxWidth": 1920, // 0 表示不限制
        "maxHeight": 0,
        "skipIfLarger": true,
        "enableLogging": false
    },
    "picgoPlugins": {
        "picgo-plugin-optimization": true // 开启本插件（关键）
    },
    "picBed": {
        "uploader": "smms" // 举例：根据你的实际图床配置
    }
}
```

随后直接执行：

```bash
picgo upload ./images/example.png
```

即可在上传前自动优化。

---

### 3⃣ 在 Node.js 中编程使用

如果你在脚本里直接使用 PicGo：

```ts
import PicGo from "picgo";
// 若使用 commonjs: const PicGo = require('picgo')

// 1. 初始化实例
const picgo = new PicGo();

// 2. 配置（可与已有配置文件 merge，这里演示直接 set）
picgo.setConfig({
    "picgo-plugin-optimization": {
        format: "webp",
        quality: 80,
        maxWidth: 1920,
        maxHeight: 0,
        skipIfLarger: true,
        enableLogging: true,
    },
    picgoPlugins: {
        "picgo-plugin-optimization": true, // 开启本插件（关键）
    },
    picBed: {
        uploader: "smms", // 根据实际图床调整
    },
});

// 3. 显式加载插件（当你没有通过 PicGo 的自动加载机制时）
picgo.use(require("picgo-plugin-optimization"));

// 4. 上传
(async () => {
    const output = await picgo.upload(["./test.png"]);
    console.log("上传结果:", output);
})();
```

如果你已经把插件安装在 PicGo 默认的插件目录（或全局位置），PicGo 可能会自动发现；如果遇到未执行优化，可强制调用 `picgo.use()`。

---

### ⚙️ 配置字段说明

| 字段            | 类型      | 默认         | 说明                                                     |
| --------------- | --------- | ------------ | -------------------------------------------------------- |
| `format`        | `string`  | (保持原格式) | 目标格式：`jpeg` \| `jpg` \| `png` \| `webp` \| `jp2` \| `tiff` \| `avif` \| `heif` \| `jxl` \| `svg` \| `gif`，留空或不填表示不转换 |
| `quality`       | `number`  | `80`         | 输出质量 (1-100)，对有损格式生效（如 jpeg/webp/avif 等） |
| `maxWidth`      | `number`  | `0`          | 最大宽度，0 表示不限制；若超过会等比缩放                 |
| `maxHeight`     | `number`  | `0`          | 最大高度，0 表示不限制；与 `maxWidth` 一起等比约束       |
| `skipIfLarger`  | `boolean` | `true`       | 若优化后文件体积更大则自动回退原图                       |
| `enableLogging` | `boolean` | `false`      | 输出更详细的调试日志（PicGo 日志面板或控制台）           |

> 注意：`svg` / `gif` 等格式在某些转换路径下可能不会有明显压缩收益；`avif`、`heif`、`jxl` 等需要 `sharp`/`libvips` 当前编译版本支持，否则可能回退或报错。

---

### 💡 常见问题 (FAQ)

1. 没有生效？
    - 确认 `beforeUploadPlugins` 中包含 `optimization`
    - 确认图片确实被 PicGo 走了上传流程（不是图床直链缓存等）
    - 打开 `enableLogging` 查看调试日志
2. 体积为什么变大？
    - 某些图片已高度压缩，再次有损压缩难以缩小；可以开启 `skipIfLarger`（默认已开）自动回退。
3. 是否可以只缩放不改格式？
    - 可以，把 `format` 留空，只设置 `maxWidth` / `maxHeight`。
4. 转成 `webp/avif` 后透明度丢失？
    - 请使用最新 `sharp`，大多数情况下透明度会保留；若仍有问题可以退回 `png`。

---

### 🔬 示例：最常见的配置（转 WebP 并最长边不超过 1920）

```jsonc
{
    "picgo-plugin-optimization": {
        "format": "webp",
        "quality": 82,
        "maxWidth": 1920,
        "maxHeight": 0,
        "skipIfLarger": true,
        "enableLogging": false
    },
    "picgoPlugins": {
        "picgo-plugin-optimization": true // 开启本插件（关键）
    }
}
```

---

### 🧪 提示：如何验证插件是否工作

1. 打开日志（或开启 `enableLogging`）
2. 上传一张较大的 JPG/PNG
3. 日志应打印 `完成优化`，并显示压缩节省百分比 / 新尺寸
4. 若配置了 `format=webp`，输出文件应看到扩展名改为 `.webp`

---

### 🧯 回退机制

当 `skipIfLarger` 为 `true`（默认）时，如果转换/压缩后的 Buffer 大于原文件，插件会放弃修改（日志会出现 `回退: 转换后更大`）。

---

### 🧱 版本与运行时

-   Node.js >= 18
-   依赖 `sharp`，请确保你的平台能正常安装其二进制（国内网络可考虑配置镜像）
-   若需 `avif/heif/jxl` 支持，请使用较新的 `sharp`/`libvips` 版本

---

## 🛠️ 开发

```sh
npm run dev
```

## 🔧 编译

```sh
npm run build
```

## 🔍 Lint

```sh
npm run lint
```

## 💾 Commit

```sh
npm run commit
```

## 👤 作者

**CaoMeiYouRen**

-   Website: [https://blog.cmyr.ltd/](https://blog.cmyr.ltd/)

-   GitHub: [@CaoMeiYouRen](https://github.com/CaoMeiYouRen)

## 🤝 贡献

欢迎 贡献、提问或提出新功能！<br />如有问题请查看 [issues page](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/issues). <br/>贡献或提出新功能可以查看[contributing guide](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/blob/master/CONTRIBUTING.md).

## 💰 支持

如果觉得这个项目有用的话请给一颗 ⭐️，非常感谢

<a href="https://afdian.com/@CaoMeiYouRen">
  <img src="https://oss.cmyr.dev/images/202306192324870.png" width="312px" height="78px" alt="在爱发电支持我">
</a>

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=CaoMeiYouRen/picgo-plugin-optimization&type=Date)](https://star-history.com/#CaoMeiYouRen/picgo-plugin-optimization&Date)

## 📝 License

Copyright © 2025 [CaoMeiYouRen](https://github.com/CaoMeiYouRen).<br />
This project is [MIT](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/blob/master/LICENSE) licensed.

---

_This README was generated with ❤️ by [cmyr-template-cli](https://github.com/CaoMeiYouRen/cmyr-template-cli)_

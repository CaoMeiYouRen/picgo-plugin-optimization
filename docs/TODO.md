已获取现有代码与配置，下面给出面向 `picgo-plugin-optimization` 的完整开发方案（含现状评估 → 架构 → 配置 → 流程 → 测试 → 发布 → 迭代计划），并结合你仓库当前状态与已添加的骨架代码进行落地说明。

## 1. 目标与范围 (MVP)

实现一个 PicGo Transformer 插件，在上传阶段对图片执行：

-   格式转换（webp / jpeg / png / avif / auto）
-   有损或无损质量压缩
-   按最大宽/高等比缩放
-   体积回退策略（压缩后更大则还原原图）
-   可选详细日志（便于调试）
-   支持 PicGo CLI 与 GUI（已含 `picgo-gui-plugin` 关键词）
    MVP 不包含：多线程批量优化、缓存、EXIF 保留/清理、渐进式 JPEG、自适应质量、AVIF 深度参数。

## 2. 当前现状评估

已具备：

-   package.json 已符合 PicGo 插件命名规范（`picgo-plugin-optimization`），包含 dual exports (cjs + esm)
-   构建工具：`tsdown` 已配置生成 `cjs` + `esm` + `d.ts`
-   测试框架：`vitest`
-   骨架：已在 index.ts 注册 `transformer: optimization`
-   版本与发布：`semantic-release` 已存在
    待完善：
-   真实 sharp 处理逻辑
-   配置项校验与默认值集中（当前散落在 config 函数）
-   错误处理与体积回退逻辑
-   单元测试与模拟 `ctx`
-   README 使用与配置示例
-   性能/效果说明与场景建议

## 3. 功能需求与优先级

MVP（必须）：

1. 读取用户配置并设默认
2. 遍历 `ctx.output` 中每个图片 buffer
3. 通过 `file-type` 或扩展名检测源类型
4. 若需要转换则用 `sharp`：
    - 加载 → 读取 metadata → 按需 resize
    - 根据目标格式与 quality 输出
5. 检查新旧体积，若 `skipIfLarger = true` 且变大则回退
6. 更新 `item.buffer`、`item.extname`、`item.fileName`（必要时）
7. 日志输出（可控）
   增强（后续）：

-   AVIF 质量与速度参数
-   透明通道保留策略（如源为 PNG 转 JPEG 可提示）
-   智能跳过（小图或低复杂度直接保留）
-   多线程（worker_threads）/ 并行度控制
-   缓存（基于 hash 或文件时间戳）
-   EXIF 清理或保留选项
-   渐进式 JPEG 与 mozjpeg 支持

## 4. 架构设计

模块建议拆分：

-   index.ts：入口 + register
-   `src/config.ts`：配置 schema + 默认值 + 读取函数
-   `src/processor.ts`：核心处理（optimizeImage 单图，processAll 批处理）
-   `src/types.ts`：类型（OptimizationConfig / InternalOptions 等）
-   `src/logger.ts`：统一 debug/可降级 console
-   `src/utils.ts`：工具函数（格式判断、文件名变更、体积对比）
    目录结构建议：

```
src/
  index.ts
  config.ts
  processor.ts
  logger.ts
  types.ts
  utils.ts
```

## 5. 配置设计

字段与默认：
| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `format` | string | `webp` | 目标格式，可为 `webp|jpeg|png|avif|auto` |
| `quality` | number | 80 | 有损格式质量 1-100 |
| `maxWidth` | number | 0 | 0 表示不限制 |
| `maxHeight` | number | 0 | 0 表示不限制 |
| `skipIfLarger` | boolean | true | 结果更大时回退原图 |
| `enableLogging` | boolean | false | 输出调试日志 |

校验策略：若用户填非法值 → 回退默认并在日志提示一次。

## 6. 处理流程（伪代码）

```ts
for each item in ctx.output:
  if !item.buffer => continue
  detect originalFormat
  targetFormat = resolveTargetFormat(config.format, originalFormat)
  if targetFormat === originalFormat and no resize => continue (节省 CPU)
  load sharp(image)
  if need resize => metadata -> compute new size -> resize()
  apply format encoder:
    switch targetFormat:
      webp: sharpObj.webp({ quality })
      jpeg: sharpObj.jpeg({ quality, mozjpeg: true })
      png: maybe lossless (quality ignored)
      avif: sharpObj.avif({ quality })
  newBuffer = await sharpObj.toBuffer()
  if config.skipIfLarger && newBuffer.length > original.length:
      log rollback
      continue
  mutate item:
     item.buffer = newBuffer
     item.extname = '.' + targetFormat
     if rename needed: item.fileName = replaceExt(item.fileName, targetFormat)
```

## 7. 关键实现要点

-   目标格式为 `auto` 时策略：
    -   若原始已为 webp/avif 且 size < 阈值 → 跳过
    -   若为 png 且含 alpha → 优先 webp；否则尝试 jpeg/webp 取较小
    -   初版可简化为：`auto` => 若源非 webp，则转 webp
-   `skipIfLarger` 实现：比较 `buffer.length`
-   避免多次编码：只执行一次格式转换
-   文件名更新：PicGo 上传时使用 `fileName`，需保持扩展名与新格式一致
-   捕获异常：单文件失败不影响其他文件

## 8. 日志与调试

-   使用 `debug('picgo-plugin-optimization')`
-   当 `enableLogging` 为真 → 强制输出关键节点：
    -   原始格式/尺寸/大小
    -   目标格式/质量/resize 后尺寸
    -   压缩后大小与压缩率：`(1 - new/old) * 100%`
    -   回退提示
-   GUI 查看：PicGo 日志窗口
-   CLI：`DEBUG=picgo-plugin-optimization picgo upload test.png`

## 9. 性能与优化策略（MVP）

-   串行遍历：对通常少量图片已足够
-   后续可加：Promise 并行 + 限制并发（p-limit），分支开关
-   避免无效操作：相同格式 + 无缩放直接跳过
-   大图裁剪：先 resize 再 encode，减少编码内存占用

## 10. 测试策略 (Vitest)

模拟 `ctx`：

-   伪造 `ctx.output = [{ buffer, fileName, extname }]`
-   伪造 `ctx.getConfig` 返回各种配置
    测试用例：

1. 默认配置 webp 转换成功
2. `format=jpeg` + `quality` 生效
3. `maxWidth` 限制缩放比例正确
4. `skipIfLarger=true` 时回退逻辑生效
5. `format=auto` 行为（webp 优先）
6. 无需转换时跳过（性能优化）
7. 处理异常（传入损坏 buffer）
   边界：

-   质量越界（<1 或 >100）→ 回退默认
-   超大图（模拟 metadata）→ 正确缩放
-   有 alpha 的 PNG 转 JPEG（可提醒保留 webp）—— 可先跳过或标记待增强

可创建 `tests/processor.spec.ts`。

## 11. 构建与发布流程

构建：

```
pnpm build
```

输出：

-   `dist/index.cjs`
-   `dist/index.mjs`
-   `dist/index.d.mts`
    CI / Release（semantic-release）：
-   Conventional commits -> 自动版本 & CHANGELOG
-   验证 Node >=18
    发布后验证：

```
picgo install optimization
```

手工本地链接（开发）：

```
pnpm link --global
picgo use transformer optimization
```

## 12. 兼容性与边界

-   Node >=18（已在 engines 声明）
-   Windows/macOS/Linux：`sharp` 预编译二进制支持
-   WebP/AVIF 支持取决于 sharp 编译（默认开启）
-   大文件内存：单次处理内存由 sharp 内部控制，后续可做流式或分块（非 MVP）

## 13. 迭代路线 (建议 Sprints)

Sprint 1（当前进行中）：

-   骨架 + 配置 + 基础转换（webp/jpeg/png）
    Sprint 2：
-   尺寸限制 + skipIfLarger + 日志完善
-   单元测试覆盖主路径
    Sprint 3：
-   `auto` 策略优化 + AVIF 支持
-   README 文档 & 示例更新
    Sprint 4：
-   性能评估、回归测试、发布
    后续路线：
-   缓存、多线程、智能质量、EXIF/ICC 处理

## 14. 风险与缓解

| 风险                  | 影响         | 缓解                                          |
| --------------------- | ------------ | --------------------------------------------- |
| sharp 安装失败        | 阻塞安装     | 在 README 提供解决方案（国内镜像 / node-gyp） |
| 转换后体积反增        | 用户体验差   | 默认启用 `skipIfLarger`                       |
| Alpha 丢失（转 JPEG） | 透明背景失效 | 提示用户或自动切换 webp                       |
| AVIF 质量理解差       | 画质问题     | 文档示例推荐区间 (50-70)                      |
| 大图 OOM              | 失败         | 先 resize 后 encode；后续加并行限制           |

## 15. TODO 列表映射当前仓库

| ID  | 标题               | 状态   | 说明                                       |
| --- | ------------------ | ------ | ------------------------------------------ |
| 1   | 交付总体开发方案   | 已完成 | 本方案即交付                               |
| 2   | 实现插件核心骨架   | 已完成 | 已写入 index.ts                            |
| 3   | 实现图像处理逻辑   | 未开始 | 待补 `sharp` 逻辑（新增 `processor.ts`）   |
| 4   | 添加配置 Schema    | 部分   | 现内联，后抽离 `config.ts`                 |
| 5   | 实现日志与错误处理 | 待做   | 封装 `logger.ts`，增加回退日志             |
| 6   | 编写单元测试       | 待做   | 计划目录 `tests/`                          |
| 7   | 完善 README 与用例 | 待做   | 增加 PicGo 使用/配置示例                   |
| 8   | 发布流程验证       | 待做   | 构建 →`semantic-release` dry-run→ 真实发布 |
| 9   | 后续增强计划       | 待做   | 文档列出延伸路线                           |

## 16. 下一步实施建议（立即可做）

1. 抽离配置与类型文件
2. 编写 `optimizeImage` + `processAll`，插入现有 `handle`
3. 写 2~3 个基础测试（webp 转换、质量、跳过）
4. 更新 README 增加 PicGo 配置片段
5. 准备 dry-run：`semantic-release --dry-run`

## 17. 处理逻辑示例代码（计划实现稿）

```ts
// processor.ts (计划)
import sharp from "sharp";
import type { IPicGo } from "picgo";
import { getConfig } from "./config";
import { logger } from "./logger";
import { detectFormat, replaceExt } from "./utils";

export async function processAll(ctx: IPicGo) {
    const cfg = getConfig(ctx);
    for (const item of ctx.output) {
        if (!item.buffer) continue;
        try {
            const beforeSize = item.buffer.length;
            const originalFormat = detectFormat(item);
            const targetFormat = resolveTargetFormat(
                cfg.format,
                originalFormat
            );
            const needResize = cfg.maxWidth || cfg.maxHeight;
            if (targetFormat === originalFormat && !needResize) {
                continue;
            }
            let image = sharp(item.buffer, { sequentialRead: true });
            const meta = await image.metadata();
            // resize
            if (needResize && meta.width && meta.height) {
                const { width, height } = computeResize(
                    meta.width,
                    meta.height,
                    cfg
                );
                if (width !== meta.width || height !== meta.height) {
                    image = image.resize(width, height);
                }
            }
            image = applyFormat(image, targetFormat, cfg);
            const outBuffer = await image.toBuffer();
            if (cfg.skipIfLarger && outBuffer.length > beforeSize) {
                logger.info(
                    "skip larger %s -> %d >= %d",
                    item.fileName,
                    outBuffer.length,
                    beforeSize
                );
                continue;
            }
            item.buffer = outBuffer;
            item.extname = "." + targetFormat;
            item.fileName = replaceExt(item.fileName, targetFormat);
            logger.info(
                "optimized %s saved %.2f%",
                item.fileName,
                (1 - outBuffer.length / beforeSize) * 100
            );
        } catch (e) {
            logger.error("optimize failed: %s %O", item.fileName, e);
        }
    }
}
```

## 18. README 更新建议（片段）

```md
### PicGo 配置示例 (data.json)

{
"picgo-plugin-optimization": {
"format": "webp",
"quality": 80,
"maxWidth": 1920,
"skipIfLarger": true,
"enableLogging": false
},
"transformer": {
"optimization": {
"format": "webp"
}
}
}
启用：
picgo use transformer optimization
```

# picgo-plugin-optimization

## [1.1.3](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/compare/v1.1.2...v1.1.3) (2026-06-22)


### 🐛 Bug 修复

* **config:** 规范化用户配置处理逻辑 ([262a57f](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/262a57f))

## [1.1.2](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/compare/v1.1.1...v1.1.2) (2026-05-27)


### 🐛 Bug 修复

* **deps:** 修复安全依赖告警 ([ca61283](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/ca61283))

## [1.1.1](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/compare/v1.1.0...v1.1.1) (2026-05-09)


### 🐛 Bug 修复

* **tsdown:** 重构依赖项配置 ([aae8175](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/aae8175))


### 📦 代码重构

* **tsdown:** 修改 neverBundle 依赖项，添加 picgo 和 axios ([52b0975](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/52b0975))

# [1.1.0](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/compare/v1.0.3...v1.1.0) (2026-04-16)


### ✨ 新功能

* **index:** 增强图片处理功能 ([aa8769d](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/aa8769d))

## [1.0.3](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/compare/v1.0.2...v1.0.3) (2025-11-19)


### 🐛 Bug 修复

* remove deprecated git add from lint-staged config ([397315a](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/397315a))
* update dependencies and fix security vulnerabilities ([5835418](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/5835418))

## [1.0.2](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/compare/v1.0.1...v1.0.2) (2025-11-11)


### 🐛 Bug 修复

* **effort:** 添加 normalizeEffort 函数以归一化 effort 参数并在格式应用中使用 ([5da67a1](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/5da67a1))
* **png:** 始终将 compressionLevel 设置为 9 以优化 PNG 压缩效果 ([c4175cc](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/c4175cc))

## [1.0.1](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/compare/v1.0.0...v1.0.1) (2025-11-07)


### 🐛 Bug 修复

* **png:** 优化 PNG 压缩级别计算逻辑 ([11222bf](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/11222bf))

# 1.0.0 (2025-09-21)


### ✨ 新功能

* 实现图像优化处理逻辑，支持格式转换和尺寸调整 ([12b9fd7](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/12b9fd7))
* 添加 GUI 菜单功能，支持查看配置、切换日志和设置目标格式 ([07ec090](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/07ec090))
* 添加 PicGo Transformer 插件开发方案文档及核心处理逻辑占位 ([5a53c06](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/5a53c06))


### 🐛 Bug 修复

* 更新 GUI 菜单，修改配置查看标签并移除不必要的功能 ([4682faa](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/4682faa))
* 更新用户配置说明，优化目标格式处理逻辑 ([eaec7d6](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/eaec7d6))
* 注释掉不必要的条件判断，简化处理逻辑 ([0f55480](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/0f55480))
* 移除不必要的接口定义，调整调试日志配置 ([fc495c6](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/fc495c6))


### 📦 代码重构

* 增强日志功能，支持更灵活的日志输出和错误处理 ([562e278](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/562e278))
* 更新插件注册方式，使用 beforeUpload 替代 transformer ([6154bdc](https://github.com/CaoMeiYouRen/picgo-plugin-optimization/commit/6154bdc))

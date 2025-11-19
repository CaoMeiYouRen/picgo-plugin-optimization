# picgo-plugin-optimization

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

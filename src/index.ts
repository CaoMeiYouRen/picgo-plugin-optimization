import { IPicGo, IPluginConfig } from 'picgo'
import { fileTypeFromBuffer } from 'file-type'
import sharp from 'sharp'

// 统一日志封装，优先使用 ctx.log，受 enableLogging 控制
function createLogger(ctx: IPicGo, enable: boolean) {
    const base = ctx.log || console
    return {
        info: (...args: any[]) => enable && base.info?.('[optimization]', ...args),
        warn: (...args: any[]) => {
            if (!enable) {
                return
            }
            if (base.warn) {
                base.warn('[optimization]', ...args)
            } else if (base.info) {
                base.info('[optimization][WARN]', ...args)
            } else {
                console.warn('[optimization]', ...args)
            }
        },
        error: (...args: any[]) => {
            if (base.error) {
                base.error('[optimization]', ...args)
            } else if (base.info) {
                base.info('[optimization][ERR]', ...args)
            } else {
                console.error('[optimization]', ...args)
            }
        }, // error 总是输出
    }
}

export interface IPicGoOutputItem {
    buffer?: Buffer
    fileName: string
    extname?: string
    [k: string]: any
}

interface OutputFileLike {
    fileName?: string
    extname?: string
}

// 插件用户配置类型
export interface OptimizationConfig {
    format?: string // 若为空或未指定，则保持原格式；填写支持格式则强制转换
    quality?: number // 质量 1-100
    maxWidth?: number // 最大宽度
    maxHeight?: number // 最大高度
    enableLogging?: boolean // 是否输出详细日志
    skipIfLarger?: boolean // 如果转换后体积更大则回退原始
}

// 从 PicGo 配置读取当前插件配置（统一规范化类型，防御 PicGo input 类型返回字符串的问题）
function getUserConfig(ctx: IPicGo): OptimizationConfig {
    const raw = (ctx.getConfig<any>('picgo-plugin-optimization') || {}) as Record<string, unknown>
    return {
        format: String(raw.format ?? ''),
        quality: normalizeQuality(raw.quality as number | string | undefined),
        maxWidth: Number(raw.maxWidth) || 0,
        maxHeight: Number(raw.maxHeight) || 0,
        skipIfLarger: normalizeBool(raw.skipIfLarger, true),
        enableLogging: normalizeBool(raw.enableLogging, false),
    }
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
        return value
    }
    if (typeof value === 'string') {
        const lower = value.toLowerCase()
        if (lower === 'true') {
            return true
        }
        if (lower === 'false') {
            return false
        }
    }
    return fallback
}

// 生成可视化配置 Schema（GUI / CLI config）
function config(ctx: IPicGo): IPluginConfig[] {
    const userConfig = getUserConfig(ctx)
    return [
        {
            name: 'format',
            type: 'input',
            default: userConfig.format ?? '',
            alias: '输出格式(留空保持原格式)',
            message: '可填写: jpeg|jpg|png|webp|jp2|tiff|avif|heif|jxl|svg|gif；留空表示不转换',
            required: false,
        },
        {
            name: 'quality',
            type: 'input',
            default: userConfig.quality ?? 80,
            alias: '质量(1-100)',
            message: '输出图像质量（有损格式生效）',
            required: false,
        },
        {
            name: 'maxWidth',
            type: 'input',
            default: userConfig.maxWidth ?? 0,
            alias: '最大宽度(0 表示不限制)',
            message: '超过该宽度会等比缩放',
            required: false,
        },
        {
            name: 'maxHeight',
            type: 'input',
            default: userConfig.maxHeight ?? 0,
            alias: '最大高度(0 表示不限制)',
            message: '超过该高度会等比缩放',
            required: false,
        },
        {
            name: 'skipIfLarger',
            type: 'confirm',
            default: userConfig.skipIfLarger ?? true,
            alias: '若变大则回退',
            message: '若压缩/转换后文件体积更大则回退原图',
            required: false,
        },
        {
            name: 'enableLogging',
            type: 'confirm',
            default: userConfig.enableLogging ?? false,
            alias: '启用详细日志',
            message: '输出调试信息（在 PicGo 日志中）',
            required: false,
        },
    ]
}


// GUI 菜单 (PicGo GUI 调用)
function guiMenu(ctx: IPicGo) {
    const userConfig = getUserConfig(ctx)
    const logger = createLogger(ctx, userConfig.enableLogging)
    return [
        {
            label: '查看当前json配置',
            async handle(innerCtx: IPicGo, guiApi: any) {
                const cfg = innerCtx.getConfig('picgo-plugin-optimization') || {}
                const text = JSON.stringify(cfg, null, 2)
                if (guiApi?.showMessageBox) {
                    await guiApi.showMessageBox({ title: 'picgo-plugin-optimization 配置', message: text, type: 'info' })
                } else {
                    logger.info('[optimization] 当前配置', text)
                }
            },
        },
    ]
}

// 核心处理逻辑
async function handle(ctx: IPicGo): Promise<void> {
    const userConfig = getUserConfig(ctx)
    const logger = createLogger(ctx, userConfig.enableLogging)
    logger.info('用户配置', userConfig)
    const output = ctx.output || []
    for (const item of output) {
        try {
            if (!item.buffer) {
                continue
            }
            const beforeSize = item.buffer.length
            const originalExt = getFileExtension(item)
            // 远端图片转存时响应头和扩展名都可能不可靠，优先用二进制内容识别真实格式。
            const sourceFormat = await detectSourceFormat(item.buffer, originalExt)
            const targetFormat = resolveTargetFormat(userConfig.format, sourceFormat)
            const quality = normalizeQuality(userConfig.quality)
            const maxWidth = userConfig.maxWidth
            const maxHeight = userConfig.maxHeight
            const skipIfLarger = userConfig.skipIfLarger
            const needResize = hasResizeConstraints(maxWidth, maxHeight)

            logger.info('处理文件', {
                file: item.fileName,
                originalExt,
                sourceFormat,
                size: beforeSize,
                plan: { format: targetFormat, quality, resize: (maxWidth || maxHeight) ? `${maxWidth || 'auto'}x${maxHeight || 'auto'}` : 'no' },
            })

            // 只有这次处理本身是 no-op 时才跳过，避免 quality < 100 的同格式图片漏掉压缩。
            if (shouldSkipOptimization(sourceFormat, targetFormat, quality, needResize)) {
                logger.info('跳过处理: 源格式与目标格式一致且未请求压缩或缩放', {
                    file: item.fileName,
                    sourceFormat,
                    targetFormat,
                    quality,
                })
                continue
            }

            const { buffer: newBuffer, widthChanged } = await optimizeBuffer(item.buffer, {
                targetFormat,
                quality,
                maxWidth,
                maxHeight,
            })

            // 某些原图已经非常激进地压缩过，结果更大时直接回退，避免劣化用户体验。
            if (skipIfLarger && newBuffer.length > beforeSize) {
                logger.warn('回退: 转换后更大', { file: item.fileName, before: beforeSize, after: newBuffer.length })
                continue
            }

            item.buffer = newBuffer
            // 只有格式确实变化时才改扩展名，避免同格式压缩后把文件名改坏。
            if (!isSameFormat(targetFormat, originalExt)) {
                item.extname = `.${targetFormat}`
                if (item.fileName) {
                    item.fileName = replaceFileExt(item.fileName, targetFormat)
                }
            }
            const saved = ((1 - newBuffer.length / beforeSize) * 100).toFixed(2)
            logger.info('完成优化', { file: item.fileName, widthChanged, savedPercent: saved, newSize: newBuffer.length })
        } catch (err) {
            logger.error('处理失败', item.fileName, err)
        }
    }
}

// ---------- 辅助逻辑实现 ----------

interface OptimizeOptions {
    targetFormat: string
    quality: number
    maxWidth: number
    maxHeight: number
}

function normalizeQuality(q?: number | string): number {
    const num = typeof q === 'string' ? Number(q) : q
    if (typeof num !== 'number' || Number.isNaN(num)) {
        return 80
    }
    if (num < 1) {
        return 1
    }
    if (num > 100) {
        return 100
    }
    return Math.round(num)
}

/**
 * 计算 effort 参数，根据不同的范围，将 effort 映射到规定的 effort 范围内
 * @param effort 输入的 effort 值
 * @returns 归一化后的 effort 值
 */
function normalizeEffort(effort?: number, min = 1, max = 10): number {
    if (typeof effort !== 'number') {
        return Math.round((min + max) / 2)
    }
    if (effort < min) {
        return min
    }
    if (effort > max) {
        return max
    }
    return Math.round(effort)
}

export type Format = 'jpeg' | 'jpg' | 'png' | 'webp' | 'jp2' | 'tiff' | 'avif' | 'heif' | 'jxl' | 'svg' | 'gif'
const SUPPORTED_FORMATS: Format[] = ['jpeg', 'jpg', 'png', 'webp', 'jp2', 'tiff', 'avif', 'heif', 'jxl', 'svg', 'gif']

function normalizeFormatAlias(format: string): string {
    const lower = format.toLowerCase()
    switch (lower) {
        case 'jpg':
            return 'jpeg'
        case 'heic':
            return 'heif'
        default:
            return lower
    }
}

function isSameFormat(source: string, target: string): boolean {
    return normalizeFormatAlias(source) === normalizeFormatAlias(target)
}

function hasResizeConstraints(maxWidth: number, maxHeight: number): boolean {
    return Boolean(maxWidth || maxHeight)
}

function shouldSkipOptimization(sourceFormat: string, targetFormat: string, quality: number, needResize: boolean): boolean {
    return !needResize && quality >= 100 && isSameFormat(sourceFormat, targetFormat)
}

function getFileExtension(item: OutputFileLike): string {
    return (item.extname || item.fileName?.split('.').pop() || '').toLowerCase().replace(/^\./, '')
}

async function detectSourceFormat(input: Buffer, fallbackExt: string): Promise<string> {
    const detected = await fileTypeFromBuffer(input)
    if (detected?.ext) {
        return detected.ext.toLowerCase()
    }

    // 极少数格式 file-type 识别不到时，再让 sharp 读取 metadata 做兜底。
    const metadata = await sharp(input, { sequentialRead: true }).metadata()
    if (metadata.format) {
        return metadata.format.toLowerCase()
    }

    return fallbackExt
}

function resolveTargetFormat(target: string, original: string): string {
    if (!target) {
        // 未配置 => 保持原格式
        return original
    }
    const lower = target.toLowerCase()
    if (SUPPORTED_FORMATS.includes(lower as Format)) {
        // 若与原格式相同则等同于不转换
        return lower
    }
    // 不支持的目标 => 保持原格式
    return original
}

function replaceFileExt(name: string, ext: string): string {
    return `${name.replace(/\.[^.]+$/, '')}.${ext}`
}

interface OptimizeResult {
    buffer: Buffer
    widthChanged: boolean
}

async function optimizeBuffer(input: Buffer, opt: OptimizeOptions): Promise<OptimizeResult> {
    const { targetFormat, quality, maxWidth, maxHeight } = opt
    const image = sharp(input, { sequentialRead: true })
    const meta = await image.metadata()
    let widthChanged = false
    let resized = image
    // 先缩放再编码，既能减少编码成本，也能避免对原始尺寸做无意义重编码。
    if ((maxWidth || maxHeight) && meta.width && meta.height) {
        const { width, height } = computeResize(meta.width, meta.height, maxWidth, maxHeight)
        if (width !== meta.width || height !== meta.height) {
            resized = resized.resize(width, height)
            widthChanged = true
        }
    }
    const encoded = applyFormat(resized, targetFormat, quality)
    const buffer = await encoded.toBuffer()
    return { buffer, widthChanged }
}

interface Size {
    width: number
    height: number
}
function computeResize(w: number, h: number, maxW: number, maxH: number): Size {
    let width = w
    let height = h
    if (maxW && width > maxW) {
        const ratio = maxW / width
        width = maxW
        height = Math.round(height * ratio)
    }
    if (maxH && height > maxH) {
        const ratio = maxH / height
        height = maxH
        width = Math.round(width * ratio)
    }
    return { width, height }
}

function getEffort(quality: number, divisor: number = 10, offset: number = 0): number {
    return Math.floor(quality / divisor) + offset
}

function applyFormat(instance: sharp.Sharp, fmt: string, quality: number): sharp.Sharp {
    switch (fmt) {
        case 'jpg':
        case 'jpeg':
            return instance.jpeg({ quality, progressive: true, mozjpeg: true })
        case 'png':
            // compressionLevel 应该始终设置为较高的值以获得更好的压缩效果
            return instance.png({ quality, compressionLevel: 9, palette: false, effort: normalizeEffort(getEffort(quality, 10), 1, 10) })
        case 'webp':
            return instance.webp({ quality, alphaQuality: quality, effort: normalizeEffort(getEffort(quality, 15), 0, 6) })
        case 'avif':
            return instance.avif({ quality, effort: normalizeEffort(getEffort(quality, 10, -1), 0, 9) })
        case 'tiff':
            return instance.tiff({ quality, compression: 'lzw' })
        case 'gif':
            return instance.gif({ effort: normalizeEffort(getEffort(quality, 10), 1, 10) })
        case 'heif':
            return instance.heif({ quality, effort: normalizeEffort(getEffort(quality, 10, -1), 0, 9) })
        case 'jp2':
            return instance.jp2({ quality })
        case 'jxl':
            return instance.jxl({ quality, effort: normalizeEffort(getEffort(quality, 10, -1), 3, 9) })
        default:
            return instance
    }
}

// 注册 beforeUpload 插件（替代 transformer）
const register = (ctx: IPicGo): void => {
    ctx.helper.beforeUploadPlugins.register('optimization', {
        handle,
        config,
        name: '图片优化 (beforeUpload)',
    })
}

export { register }
export const beforeUploadPlugins = 'optimization'
export const __internal = {
    applyFormat,
    computeResize,
    config,
    createLogger,
    detectSourceFormat,
    getEffort,
    getFileExtension,
    getUserConfig,
    guiMenu,
    handle,
    hasResizeConstraints,
    isSameFormat,
    normalizeBool,
    normalizeFormatAlias,
    normalizeEffort,
    normalizeQuality,
    optimizeBuffer,
    register,
    replaceFileExt,
    resolveTargetFormat,
    shouldSkipOptimization,
}

module.exports = (ctx: IPicGo) => {
    void ctx
    return {
        register,
        beforeUploadPlugins,
        guiMenu,
        config,
    }
}

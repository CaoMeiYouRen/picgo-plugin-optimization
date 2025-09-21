import { IPicGo, IPluginConfig } from 'picgo'
import sharp from 'sharp'

// const debug = process.env.NODE_ENV === 'production' ? console.log : Debug('picgo-plugin-optimization')
const debug = console.log

export interface IPicGoOutputItem {
    buffer?: Buffer
    fileName: string
    extname?: string
    [k: string]: any
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

// 从 PicGo 配置读取当前插件配置
function getUserConfig(ctx: IPicGo): OptimizationConfig {
    const cfg = ctx.getConfig<OptimizationConfig>('picgo-plugin-optimization') || {}
    return cfg
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
    return [
        {
            label: '查看当前json配置',
            async handle(innerCtx: IPicGo, guiApi: any) {
                const cfg = innerCtx.getConfig('picgo-plugin-optimization') || {}
                const text = JSON.stringify(cfg, null, 2)
                if (guiApi?.showMessageBox) {
                    await guiApi.showMessageBox({ title: 'picgo-plugin-optimization 配置', message: text, type: 'info' })
                } else {
                    debug('当前配置', text)
                }
            },
        },
    ]
}

// 核心处理逻辑占位（后续补完 sharp 处理）
async function handle(ctx: IPicGo): Promise<void> {
    const userConfig = getUserConfig(ctx)
    if (userConfig.enableLogging) {
        debug('用户配置: %O', userConfig)
    }
    const output = ctx.output || []
    for (const item of output) {
        try {
            if (!item.buffer) {
                continue
            }
            const beforeSize = item.buffer.length
            const originalExt = (item.extname || item.fileName.split('.').pop() || '').toLowerCase().replace(/^\./, '')
            const targetFormat = resolveTargetFormat(userConfig.format || '', originalExt)
            const quality = normalizeQuality(userConfig.quality)
            const maxWidth = userConfig.maxWidth || 0
            const maxHeight = userConfig.maxHeight || 0
            const skipIfLarger = userConfig.skipIfLarger !== false // 默认 true

            if (userConfig.enableLogging) {
                debug('处理文件: %s 原始: ext=%s size=%d 计划: format=%s quality=%s resize=%s', item.fileName, originalExt, beforeSize, targetFormat, quality, (maxWidth || maxHeight) ? `${maxWidth || 'auto'}x${maxHeight || 'auto'}` : 'no')
            }

            // 若无需转换且无需缩放则跳过
            const needResize = !!(maxWidth || maxHeight)
            if (!needResize && targetFormat === originalExt) {
                continue
            }

            const { buffer: newBuffer, widthChanged } = await optimizeBuffer(item.buffer, {
                targetFormat,
                quality,
                maxWidth,
                maxHeight,
            })

            if (skipIfLarger && newBuffer.length > beforeSize) {
                if (userConfig.enableLogging) {
                    debug('回退: 转换后体积更大 %s %d -> %d', item.fileName, beforeSize, newBuffer.length)
                }
                continue
            }

            item.buffer = newBuffer
            if (targetFormat !== originalExt) {
                item.extname = `.${targetFormat}`
                item.fileName = replaceFileExt(item.fileName, targetFormat)
            }
            if (userConfig.enableLogging) {
                const saved = ((1 - newBuffer.length / beforeSize) * 100).toFixed(2)
                debug('完成: %s 新尺寸变更=%s 节省=%s%% 新体积=%d', item.fileName, widthChanged, saved, newBuffer.length)
            }
        } catch (err) {
            debug('处理失败: %s %O', item.fileName, err)
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

function normalizeQuality(q?: number): number {
    if (typeof q !== 'number') {
        return 80
    }
    if (q < 1) {
        return 1
    }
    if (q > 100) {
        return 100
    }
    return Math.round(q)
}

export type Format = 'jpeg' | 'jpg' | 'png' | 'webp' | 'jp2' | 'tiff' | 'avif' | 'heif' | 'jxl' | 'svg' | 'gif'
const SUPPORTED_FORMATS: Format[] = ['jpeg', 'jpg', 'png', 'webp', 'jp2', 'tiff', 'avif', 'heif', 'jxl', 'svg', 'gif']

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
    // resize 逻辑
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

function applyFormat(instance: sharp.Sharp, fmt: string, quality: number): sharp.Sharp {
    switch (fmt) {
        case 'jpg':
        case 'jpeg':
            return instance.jpeg({ quality, progressive: true, mozjpeg: true })
        case 'png':
            return instance.png({ quality, compressionLevel: quality >= 90 ? 9 : 8, palette: false })
        case 'webp':
            return instance.webp({ quality })
        case 'avif':
            return instance.avif({ quality })
        case 'tiff':
            return instance.tiff({ quality, compression: 'lzw' })
        case 'gif':
            return instance.gif({ effort: Math.min(10, Math.max(0, Math.floor(quality / 10))) })
        case 'heif':
            return instance.heif({ quality })
        case 'jp2':
            return instance.jp2({ quality })
        case 'jxl':
            return instance.jxl({ quality })
        default:
            return instance
    }
}

// 注册 transformer
const register = (ctx: IPicGo): void => {
    ctx.helper.transformer.register('optimization', {
        handle,
        config,
    })
}

export { register }
export const transformer = 'optimization'


module.exports = (ctx: IPicGo) => ({
    register,
    transformer,
    guiMenu,
    config,
})

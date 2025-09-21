import Debug from 'debug'
import PicGo, { IPluginConfig } from 'picgo'
import sharp from 'sharp'
const debug = Debug('picgo-plugin-optimization')

export interface IPicGoOutputItem {
    buffer?: Buffer
    fileName: string
    extname?: string
    [k: string]: any
}

export interface IPicGo {
    output: IPicGoOutputItem[]
    getConfig: <T = any>(path: string) => T | undefined
    helper: {
        transformer: {
            register: (
                name: string,
                transformer: {
                    handle: (ctx: IPicGo) => Promise<void> | void
                    config?: (ctx: IPicGo) => IPluginConfig[]
                },
            ) => void
        }
    }
    [k: string]: any
}

// 插件用户配置类型
export interface OptimizationConfig {
    format?: string // 目标格式: webp|jpeg|png|avif|auto 等
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
            default: userConfig.format ?? 'webp',
            alias: '目标格式(webp/jpeg/png/avif/auto)',
            message: '输入目标格式，auto 表示按源图自动判断是否需要转换',
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
            // 这里稍后接入 sharp 处理
            if (userConfig.enableLogging) {
                debug('处理文件: %s, size=%d', item.fileName, item.buffer.length)
            }
            // 未来: 读取 image metadata, 按需缩放 / 转换
        } catch (err) {
            debug('处理失败: %s %O', item.fileName, err)
        }
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

export default (ctx: IPicGo) => ({
    register,
    transformer,
})


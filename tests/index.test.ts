import type { IPicGo } from 'picgo'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

import { __internal, type IPicGoOutputItem, type OptimizationConfig } from '../src/index'

async function createImageBuffer(format: 'avif' | 'jpeg', width = 48, height = 32): Promise<Buffer> {
    const image = sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 96, g: 128, b: 192, alpha: 1 },
        },
    })

    if (format === 'avif') {
        return image.avif({ quality: 80 }).toBuffer()
    }

    return image.jpeg({ quality: 80 }).toBuffer()
}

async function createNoisyJpegBuffer(width = 64, height = 64): Promise<Buffer> {
    const raw = Buffer.alloc(width * height * 3)
    for (let i = 0; i < raw.length; i += 1) {
        raw[i] = (i * 37) % 256
    }

    return sharp(raw, {
        raw: {
            width,
            height,
            channels: 3,
        },
    }).jpeg({ quality: 35 }).toBuffer()
}

function createCtx(config: OptimizationConfig, output: IPicGoOutputItem[]): IPicGo {
    return {
        getConfig: () => config,
        log: {
            error: () => undefined,
            info: () => undefined,
            warn: () => undefined,
        },
        output,
    } as unknown as IPicGo
}

function createLoggerCtx(log?: Partial<Console>): IPicGo {
    return {
        getConfig: () => ({}),
        log,
        output: [],
    } as unknown as IPicGo
}

describe('optimization beforeUpload handler', () => {
    it('skips processing only when source and target formats match and quality is 100', async () => {
        const buffer = await createImageBuffer('avif')
        const item: IPicGoOutputItem = {
            buffer,
            extname: '.avif',
            fileName: 'sample.avif',
        }
        const ctx = createCtx({ format: 'avif', quality: 100 }, [item])

        await __internal.handle(ctx)

        expect(item.buffer).toBe(buffer)
        expect(item.fileName).toBe('sample.avif')
        expect(item.extname).toBe('.avif')
    })

    it('still recompresses when the format matches but quality is lower than 100', async () => {
        const buffer = await createImageBuffer('avif')
        const item: IPicGoOutputItem = {
            buffer,
            extname: '.avif',
            fileName: 'sample.avif',
        }
        const ctx = createCtx({ format: 'avif', quality: 80, skipIfLarger: false }, [item])

        await __internal.handle(ctx)

        expect(item.buffer).not.toBe(buffer)
        expect(item.fileName).toBe('sample.avif')
        expect(item.extname).toBe('.avif')
    })

    it('treats jpg and jpeg as the same format and skips only true no-op processing', async () => {
        const buffer = await createImageBuffer('jpeg')
        const item: IPicGoOutputItem = {
            buffer,
            extname: '.jpeg',
            fileName: 'sample.jpeg',
        }
        const ctx = createCtx({ format: 'jpg', quality: 100 }, [item])

        await __internal.handle(ctx)

        expect(item.buffer).toBe(buffer)
        expect(item.fileName).toBe('sample.jpeg')
        expect(item.extname).toBe('.jpeg')
    })

    it('still optimizes when resize is requested even if source and target formats match', async () => {
        const buffer = await createImageBuffer('avif', 80, 40)
        const item: IPicGoOutputItem = {
            buffer,
            extname: '.avif',
            fileName: 'sample.avif',
        }
        const ctx = createCtx({ format: 'avif', maxWidth: 20 }, [item])

        await __internal.handle(ctx)

        expect(item.buffer).not.toBe(buffer)
        expect(item.fileName).toBe('sample.avif')
        const metadata = await sharp(item.buffer).metadata()
        expect(metadata.width).toBe(20)
    })

    it('skips items without buffer', async () => {
        const item = {
            extname: '.avif',
            fileName: 'sample.avif',
        } as IPicGoOutputItem
        const ctx = createCtx({ format: 'avif', quality: 80 }, [item])

        await __internal.handle(ctx)

        expect(item.buffer).toBeUndefined()
        expect(item.fileName).toBe('sample.avif')
    })

    it('rolls back when skipIfLarger is enabled and output becomes larger', async () => {
        const buffer = await createNoisyJpegBuffer()
        const item: IPicGoOutputItem = {
            buffer,
            extname: '.jpeg',
            fileName: 'sample.jpeg',
        }
        const ctx = createCtx({ format: 'png', quality: 100, skipIfLarger: true }, [item])

        await __internal.handle(ctx)

        expect(item.buffer).toBe(buffer)
        expect(item.fileName).toBe('sample.jpeg')
        expect(item.extname).toBe('.jpeg')
    })

    it('logs errors and continues when processing fails for a broken buffer', async () => {
        const logger = {
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        }
        const ctx = {
            getConfig: () => ({ format: 'webp', enableLogging: true }),
            log: logger,
            output: [{ buffer: Buffer.from('not-an-image'), fileName: 'broken.bin', extname: '.bin' }],
        } as unknown as IPicGo

        await __internal.handle(ctx)

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error.mock.calls[0]?.[0]).toBe('[optimization]')
        expect(logger.error.mock.calls[0]?.[1]).toBe('处理失败')
    })
})

describe('optimization helpers', () => {
    it('normalizes quality and effort boundaries', () => {
        expect(__internal.normalizeQuality()).toBe(80)
        expect(__internal.normalizeQuality(0)).toBe(1)
        expect(__internal.normalizeQuality(120)).toBe(100)
        expect(__internal.normalizeQuality(80.4)).toBe(80)

        expect(__internal.normalizeEffort()).toBe(6)
        expect(__internal.normalizeEffort(-3, 0, 9)).toBe(0)
        expect(__internal.normalizeEffort(99, 0, 9)).toBe(9)
    })

    it('normalizes format aliases and no-op decisions', () => {
        expect(__internal.normalizeFormatAlias('JPG')).toBe('jpeg')
        expect(__internal.normalizeFormatAlias('HEIC')).toBe('heif')
        expect(__internal.isSameFormat('jpg', 'jpeg')).toBe(true)
        expect(__internal.isSameFormat('avif', 'webp')).toBe(false)
        expect(__internal.hasResizeConstraints(0, 0)).toBe(false)
        expect(__internal.hasResizeConstraints(0, 100)).toBe(true)
        expect(__internal.shouldSkipOptimization('avif', 'avif', 100, false)).toBe(true)
        expect(__internal.shouldSkipOptimization('avif', 'avif', 99, false)).toBe(false)
    })

    it('resolves config and config schema defaults', () => {
        const ctx = createCtx({}, [])

        expect(__internal.getUserConfig(ctx)).toEqual({
            format: '',
            quality: 80,
            maxWidth: 0,
            maxHeight: 0,
            skipIfLarger: true,
            enableLogging: false,
        })

        const schema = __internal.config(ctx)
        expect(schema).toHaveLength(6)
        expect(schema[0]?.default).toBe('')
        expect(schema[1]?.default).toBe(80)
        expect(schema[4]?.default).toBe(true)
        expect(schema[5]?.default).toBe(false)
    })

    it('normalizes string config values from PicGo input fields', () => {
        const ctx = createCtx({
            format: '',
            quality: '90',
            maxWidth: '0',
            maxHeight: '800',
            skipIfLarger: 'false',
            enableLogging: 'true',
        } as any, [])

        const cfg = __internal.getUserConfig(ctx)
        expect(cfg.format).toBe('')
        expect(cfg.quality).toBe(90)
        expect(cfg.maxWidth).toBe(0)
        expect(cfg.maxHeight).toBe(800)
        expect(cfg.skipIfLarger).toBe(false)
        expect(cfg.enableLogging).toBe(true)
    })

    it('normalizeBool handles edge cases', () => {
        expect(__internal.normalizeBool(true, false)).toBe(true)
        expect(__internal.normalizeBool(false, true)).toBe(false)
        expect(__internal.normalizeBool('true', false)).toBe(true)
        expect(__internal.normalizeBool('TRUE', false)).toBe(true)
        expect(__internal.normalizeBool('false', true)).toBe(false)
        expect(__internal.normalizeBool(undefined, true)).toBe(true)
        expect(__internal.normalizeBool(null, false)).toBe(false)
        expect(__internal.normalizeBool(1, true)).toBe(true)
        expect(__internal.normalizeBool('yes', false)).toBe(false)
    })

    it('normalizeQuality handles string quality correctly', () => {
        expect(__internal.normalizeQuality('90')).toBe(90)
        expect(__internal.normalizeQuality('80.4')).toBe(80)
        expect(__internal.normalizeQuality('0')).toBe(1)
        expect(__internal.normalizeQuality('120')).toBe(100)
        expect(__internal.normalizeQuality('abc')).toBe(80)
    })

    it('handle applies string quality from PicGo config correctly', async () => {
        const buffer = await createImageBuffer('jpeg')
        const item: IPicGoOutputItem = {
            buffer,
            extname: '.jpg',
            fileName: 'test.jpg',
        }

        // Simulate string config as returned by PicGo input fields
        const ctx = createCtx({
            format: '',
            quality: '95',
            maxWidth: '0',
            maxHeight: '0',
            skipIfLarger: 'false',
            enableLogging: 'false',
        } as any, [item])

        await __internal.handle(ctx)

        // Quality 95 < 100 should trigger recompression even if format unchanged
        expect(item.buffer).not.toBe(buffer)
        // Format unchanged, so extname and fileName stay same
        expect(item.extname).toBe('.jpg')
        expect(item.fileName).toBe('test.jpg')
    })

    it('extracts file extension and resolves target format safely', () => {
        expect(__internal.getFileExtension({ extname: '.webp', fileName: 'foo.jpg' })).toBe('webp')
        expect(__internal.getFileExtension({ fileName: 'foo.avif' })).toBe('avif')
        expect(__internal.getFileExtension({})).toBe('')

        expect(__internal.resolveTargetFormat('', 'jpeg')).toBe('jpeg')
        expect(__internal.resolveTargetFormat('webp', 'jpeg')).toBe('webp')
        expect(__internal.resolveTargetFormat('invalid-format', 'jpeg')).toBe('jpeg')
        expect(__internal.replaceFileExt('foo.bar.jpeg', 'webp')).toBe('foo.bar.webp')
    })

    it('computes resize dimensions for width and height limits', () => {
        expect(__internal.computeResize(400, 200, 200, 0)).toEqual({ width: 200, height: 100 })
        expect(__internal.computeResize(400, 200, 0, 50)).toEqual({ width: 100, height: 50 })
        expect(__internal.computeResize(400, 200, 150, 50)).toEqual({ width: 100, height: 50 })
    })

    it('calculates effort buckets used by format encoders', () => {
        expect(__internal.getEffort(80)).toBe(8)
        expect(__internal.getEffort(80, 15)).toBe(5)
        expect(__internal.getEffort(80, 10, -1)).toBe(7)
    })

    it('detects source format from buffer content', async () => {
        const buffer = await createImageBuffer('jpeg')

        await expect(__internal.detectSourceFormat(buffer, 'bin')).resolves.toBe('jpg')
    })

    it('falls back to sharp metadata when file-type cannot identify the buffer', async () => {
        const buffer = await sharp({
            create: {
                width: 10,
                height: 10,
                channels: 4,
                background: { r: 255, g: 0, b: 0, alpha: 1 },
            },
        }).gif().toBuffer()

        await expect(__internal.detectSourceFormat(buffer, 'bin')).resolves.toBe('gif')
    })

    it('optimizes buffers and reports whether width changed', async () => {
        const buffer = await createImageBuffer('jpeg', 120, 60)

        const resized = await __internal.optimizeBuffer(buffer, {
            targetFormat: 'webp',
            quality: 80,
            maxWidth: 30,
            maxHeight: 0,
        })
        const resizedMeta = await sharp(resized.buffer).metadata()
        expect(resized.widthChanged).toBe(true)
        expect(resizedMeta.format).toBe('webp')
        expect(resizedMeta.width).toBe(30)

        const untouched = await __internal.optimizeBuffer(buffer, {
            targetFormat: 'jpeg',
            quality: 80,
            maxWidth: 0,
            maxHeight: 0,
        })
        expect(untouched.widthChanged).toBe(false)
    })

    it('applies multiple output formats and leaves unsupported formats unchanged', async () => {
        const pngSource = sharp({
            create: {
                width: 16,
                height: 16,
                channels: 4,
                background: { r: 120, g: 60, b: 30, alpha: 1 },
            },
        })

        const jpegBuffer = await __internal.applyFormat(pngSource.clone(), 'jpeg', 80).toBuffer()
        const webpBuffer = await __internal.applyFormat(pngSource.clone(), 'webp', 80).toBuffer()
        const avifBuffer = await __internal.applyFormat(pngSource.clone(), 'avif', 80).toBuffer()
        const unchangedBuffer = await __internal.applyFormat(pngSource.clone(), 'svg', 80).png().toBuffer()

        await expect(sharp(jpegBuffer).metadata()).resolves.toMatchObject({ format: 'jpeg' })
        await expect(sharp(webpBuffer).metadata()).resolves.toMatchObject({ format: 'webp' })
        await expect(sharp(avifBuffer).metadata()).resolves.toMatchObject({ format: 'heif' })
        await expect(sharp(unchangedBuffer).metadata()).resolves.toMatchObject({ format: 'png' })
    })

    it('creates loggers that honor enable flag and fallback methods', () => {
        const info = vi.fn()
        const warn = vi.fn()
        const error = vi.fn()
        const disabledLogger = __internal.createLogger(createLoggerCtx({ info, warn, error }), false)
        disabledLogger.info('hidden')
        disabledLogger.warn('hidden-warn')
        disabledLogger.error('visible-error')

        expect(info).not.toHaveBeenCalled()
        expect(warn).not.toHaveBeenCalled()
        expect(error).toHaveBeenCalledWith('[optimization]', 'visible-error')

        const infoOnly = vi.fn()
        const fallbackLogger = __internal.createLogger(createLoggerCtx({ info: infoOnly }), true)
        fallbackLogger.warn('warn-through-info')
        fallbackLogger.error('error-through-info')

        expect(infoOnly).toHaveBeenCalledWith('[optimization][WARN]', 'warn-through-info')
        expect(infoOnly).toHaveBeenCalledWith('[optimization][ERR]', 'error-through-info')
    })

    it('shows gui config through guiApi or logger fallback', async () => {
        const loggerInfo = vi.fn()
        const ctx = {
            getConfig: () => ({ quality: 90, enableLogging: true }),
            log: { info: loggerInfo },
            output: [],
        } as unknown as IPicGo

        const menu = __internal.guiMenu(ctx)
        const showMessageBox = vi.fn()
        await menu[0]?.handle(ctx, { showMessageBox })
        expect(showMessageBox).toHaveBeenCalledTimes(1)

        await menu[0]?.handle(ctx, undefined)
        expect(loggerInfo).toHaveBeenCalledWith('[optimization]', '[optimization] 当前配置', JSON.stringify({ quality: 90, enableLogging: true }, null, 2))
    })

    it('registers the beforeUpload plugin with picgo', () => {
        const registerSpy = vi.fn()
        const ctx = {
            helper: {
                beforeUploadPlugins: {
                    register: registerSpy,
                },
            },
        } as unknown as IPicGo

        __internal.register(ctx)

        expect(registerSpy).toHaveBeenCalledTimes(1)
        expect(registerSpy.mock.calls[0]?.[0]).toBe('optimization')
        expect(registerSpy.mock.calls[0]?.[1]).toMatchObject({
            config: __internal.config,
            handle: __internal.handle,
            name: '图片优化 (beforeUpload)',
        })
    })
})

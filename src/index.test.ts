import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { normalizeFormatAlias } from './index'

// Helper: get the handle function from the plugin
async function getPluginHandle() {
    const mod = await import('./index')
    let capturedHandle: ((ctx: any) => Promise<void>) | null = null
    const fakeCtx: any = {
        helper: {
            beforeUploadPlugins: {
                register: (_name: string, plugin: any) => {
                    capturedHandle = plugin.handle
                },
            },
        },
        getConfig: () => ({}),
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        output: [],
    }
    mod.register(fakeCtx)
    return capturedHandle
}

describe('normalizeFormatAlias', () => {
    it('maps jpg to jpeg', () => {
        expect(normalizeFormatAlias('jpg')).toBe('jpeg')
    })

    it('leaves other formats unchanged', () => {
        expect(normalizeFormatAlias('jpeg')).toBe('jpeg')
        expect(normalizeFormatAlias('avif')).toBe('avif')
        expect(normalizeFormatAlias('webp')).toBe('webp')
        expect(normalizeFormatAlias('png')).toBe('png')
    })
})

describe('handle - skip same format without resize', () => {
    it('should skip processing when source and target format are both avif and no resize is set', async () => {
        const handle = await getPluginHandle()

        // Create a small AVIF buffer
        const avifBuffer = await sharp({
            create: { width: 8, height: 8, channels: 3, background: { r: 100, g: 150, b: 200 } },
        })
            .avif({ quality: 50 })
            .toBuffer()

        const item = { buffer: avifBuffer, fileName: 'test.avif', extname: '.avif' }
        const ctx: any = {
            output: [item],
            getConfig: () => ({ format: 'avif', quality: 80, maxWidth: 0, maxHeight: 0, skipIfLarger: true }),
            log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        }

        await handle(ctx)

        // Buffer should NOT be replaced (same reference = skipped)
        expect(item.buffer).toBe(avifBuffer)
        // extname and fileName should remain unchanged
        expect(item.extname).toBe('.avif')
        expect(item.fileName).toBe('test.avif')
    })

    it('should skip processing when source is jpg and target format is jpeg and no resize is set', async () => {
        const handle = await getPluginHandle()

        const jpegBuffer = await sharp({
            create: { width: 8, height: 8, channels: 3, background: { r: 100, g: 150, b: 200 } },
        })
            .jpeg({ quality: 80 })
            .toBuffer()

        const item = { buffer: jpegBuffer, fileName: 'test.jpg', extname: '.jpg' }
        const ctx: any = {
            output: [item],
            getConfig: () => ({ format: 'jpeg', quality: 80, maxWidth: 0, maxHeight: 0, skipIfLarger: true }),
            log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        }

        await handle(ctx)

        // Buffer should NOT be replaced (same reference = skipped)
        expect(item.buffer).toBe(jpegBuffer)
    })

    it('should still process when format matches but resize is needed', async () => {
        const handle = await getPluginHandle()

        // Create an image large enough to trigger resize
        const webpBuffer = await sharp({
            create: { width: 200, height: 200, channels: 3, background: { r: 100, g: 150, b: 200 } },
        })
            .webp({ quality: 80 })
            .toBuffer()

        const item = { buffer: webpBuffer, fileName: 'test.webp', extname: '.webp' }
        const ctx: any = {
            output: [item],
            getConfig: () => ({ format: 'webp', quality: 80, maxWidth: 100, maxHeight: 0, skipIfLarger: false }),
            log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        }

        await handle(ctx)

        // Buffer should be replaced (resize was needed even though format is same)
        expect(item.buffer).not.toBe(webpBuffer)
    })

    it('should convert format when source and target formats differ', async () => {
        const handle = await getPluginHandle()

        const pngBuffer = await sharp({
            create: { width: 8, height: 8, channels: 3, background: { r: 100, g: 150, b: 200 } },
        })
            .png()
            .toBuffer()

        const item = { buffer: pngBuffer, fileName: 'test.png', extname: '.png' }
        const ctx: any = {
            output: [item],
            getConfig: () => ({ format: 'webp', quality: 80, maxWidth: 0, maxHeight: 0, skipIfLarger: false }),
            log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        }

        await handle(ctx)

        // Buffer should be replaced (format conversion happened)
        expect(item.buffer).not.toBe(pngBuffer)
        expect(item.extname).toBe('.webp')
        expect(item.fileName).toBe('test.webp')
    })
})

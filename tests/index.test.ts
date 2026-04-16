import type { IPicGo } from 'picgo'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

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
})

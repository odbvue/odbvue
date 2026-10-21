import { afterEach, describe, expect, it, vi } from 'vitest'
import { avatarInitials, createAvatar } from '@/capabilities/auth/avatar'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('profile avatars', () => {
  it('uses names, username fallback and Unicode initials', () => {
    expect(avatarInitials({ id: 1, username: 'ada', displayName: ' Ada Lovelace ' })).toBe('AL')
    expect(avatarInitials({ id: 1, username: 'ada' })).toBe('A')
    expect(avatarInitials({ id: 1, username: 'ada', displayName: 'Éva Müller' })).toBe('ÉM')
    expect(avatarInitials(null)).toBe('')
  })

  it('rejects SVG and files over the exact 5 MB limit', async () => {
    await expect(
      createAvatar(new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' })),
    ).rejects.toThrow('auth.profile.avatar.invalid')
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'avatar.png', {
      type: 'image/png',
    })
    await expect(createAvatar(oversized)).rejects.toThrow('auth.profile.avatar.invalid')
  })

  it('crops to a 128px JPEG, checks encoded size, and releases decoded images', async () => {
    const image = { width: 400, height: 200, close: vi.fn<() => void>() }
    const bitmap = vi.fn<typeof createImageBitmap>().mockResolvedValue(image)
    vi.stubGlobal('createImageBitmap', bitmap)
    const context = {
      fillStyle: '',
      fillRect: vi.fn<CanvasRenderingContext2D['fillRect']>(),
      drawImage: vi.fn<CanvasRenderingContext2D['drawImage']>(),
    }
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'getContext', { value: () => context })
    vi.spyOn(document, 'createElement').mockReturnValue(canvas)
    const encode = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,/9j/AA==')
    const file = new File([new Uint8Array(5 * 1024 * 1024)], 'avatar.png', { type: 'image/png' })
    await expect(createAvatar(file)).resolves.toBe('data:image/jpeg;base64,/9j/AA==')
    expect(bitmap).toHaveBeenCalledWith(file)
    expect(context.drawImage).toHaveBeenCalledWith(image, 100, 0, 200, 200, 0, 0, 128, 128)
    expect(encode).toHaveBeenCalledWith('image/jpeg', 0.85)
    expect(image.close).toHaveBeenCalledOnce()
    encode.mockReturnValue('data:image/jpeg;base64,' + 'A'.repeat(30000))
    await expect(createAvatar(file)).rejects.toThrow('auth.profile.avatar.invalid')
  })
})

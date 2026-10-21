import type { AuthUser } from './core.js'

export function avatarInitials(user: AuthUser | null): string {
  const name = user?.displayName?.trim() || user?.username || ''
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toLocaleUpperCase()
}

/** Re-encode uploads as small JPEGs, stripping metadata and disallowing active image formats. */
export async function createAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)
    throw new Error('auth.profile.avatar.invalid')
  let image: ImageBitmap
  try {
    image = await createImageBitmap(file)
  } catch {
    throw new Error('auth.profile.avatar.invalid')
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')
    if (!context) throw new Error('auth.profile.avatar.failed')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 128, 128)
    const size = Math.min(image.width, image.height)
    context.drawImage(
      image,
      (image.width - size) / 2,
      (image.height - size) / 2,
      size,
      size,
      0,
      0,
      128,
      128,
    )
    const avatar = canvas.toDataURL('image/jpeg', 0.85)
    if (!avatar.startsWith('data:image/jpeg;base64,') || avatar.length > 30000)
      throw new Error('auth.profile.avatar.invalid')
    return avatar
  } finally {
    image.close()
  }
}

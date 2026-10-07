export function validateAccessPolicy(meta: Record<string, unknown>): void {
  const access = meta.access
  const permissions = meta.permissions
  if (
    access !== undefined &&
    access !== 'public' &&
    access !== 'authenticated' &&
    access !== 'anonymous' &&
    !(
      Array.isArray(access) &&
      access.length > 0 &&
      access.every((role) => typeof role === 'string' && role.trim().length > 0)
    )
  ) {
    throw new Error(
      'Page access must be public, authenticated, anonymous, or a non-empty role list',
    )
  }
  if (
    permissions !== undefined &&
    !(
      Array.isArray(permissions) &&
      permissions.every(
        (permission) => typeof permission === 'string' && permission.trim().length > 0,
      )
    )
  ) {
    throw new Error('Page permissions must be an array of non-empty strings')
  }
  if (
    Array.isArray(permissions) &&
    permissions.length > 0 &&
    access !== 'authenticated' &&
    !Array.isArray(access)
  ) {
    throw new Error('Page permissions require authenticated access or a role list')
  }
  for (const key of ['roles', 'visibility', 'hidden']) {
    if (key in meta) {
      throw new Error(`Page metadata "${key}" is no longer supported; use access and navigation`)
    }
  }
}

export function validatePageMeta(meta: Record<string, unknown>, source: string): void {
  try {
    if (meta.access === undefined) throw new Error('Page access is required')
    if (typeof meta.navigation !== 'boolean') throw new Error('Page navigation must be a boolean')
    validateAccessPolicy(meta)
  } catch (error) {
    throw new Error(`Invalid page metadata in ${source}`, { cause: error })
  }
}

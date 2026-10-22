export const googleSettings = [
  { id: 'AUTH_GOOGLE_ENABLED', value: 'Y', meta: { type: 'string' } },
  {
    id: 'AUTH_GOOGLE_CLIENT_ID',
    value: '',
    meta: { type: 'string' },
  },
  {
    id: 'AUTH_GOOGLE_CLIENT_SECRET',
    value: '',
    meta: { type: 'string', secret: 'Y' as const },
  },
  { id: 'AUTH_GOOGLE_REDIRECT_URI', value: '', meta: { type: 'string' } },
]

export const googleSettings = [
  { id: 'AUTH_GOOGLE_ENABLED', value: 'Y', meta: { type: 'switch', deletable: 'N' } },
  {
    id: 'AUTH_GOOGLE_CLIENT_ID',
    value: '',
    meta: { type: 'string', deletable: 'N' },
  },
  {
    id: 'AUTH_GOOGLE_CLIENT_SECRET',
    value: '',
    meta: { type: 'string', secret: 'Y' as const, deletable: 'N' },
  },
  { id: 'AUTH_GOOGLE_REDIRECT_URI', value: '', meta: { type: 'string', deletable: 'N' } },
]

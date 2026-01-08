export const truncateMiddle = (
  value: string,
  startChars: number = 15,
  endChars: number = 15,
  ellipsis: string = '…',
): string => {
  if (!value) return ''

  const start = Math.max(0, startChars)
  const end = Math.max(0, endChars)

  if (start === 0 && end === 0) return ellipsis

  const maxLen = start + end
  if (value.length <= maxLen) return value

  const head = start > 0 ? value.slice(0, start) : ''
  const tail = end > 0 ? value.slice(value.length - end) : ''

  return `${head}${ellipsis}${tail}`
}

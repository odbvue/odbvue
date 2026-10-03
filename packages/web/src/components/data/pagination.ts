export function pageItems<T>(items: T[], itemsPerPage: number): T[] {
  return items.slice(0, itemsPerPage)
}

export function emptyRowCount(itemCount: number, itemsPerPage: number): number {
  return Math.max(itemsPerPage - itemCount, 0)
}

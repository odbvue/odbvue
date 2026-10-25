import { computed, reactive, readonly } from 'vue'

/** Tracks presentation activity; callers retain ownership of cancellation and concurrency. */
export function createLoading() {
  const counts = reactive(new Map<string, number>())
  const active = computed(() => counts.size > 0)

  function has(key: string): boolean {
    return [...counts.keys()].some((name) => name === key || name.startsWith(`${key}.`))
  }

  function start(key: string): () => void {
    if (!key.trim()) throw new Error('A loading operation key is required.')
    counts.set(key, (counts.get(key) ?? 0) + 1)
    let finished = false
    return () => {
      if (finished) return
      finished = true
      const count = counts.get(key) ?? 0
      if (count <= 1) counts.delete(key)
      else counts.set(key, count - 1)
    }
  }

  async function run<T>(key: string, action: () => T | Promise<T>): Promise<T> {
    const finish = start(key)
    try {
      return await action()
    } finally {
      finish()
    }
  }

  return { counts, active: readonly(active), has, start, run }
}

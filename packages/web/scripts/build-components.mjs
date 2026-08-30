import { readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const sourceDirectory = fileURLToPath(new URL('../src/components/', import.meta.url))
const outputDirectory = fileURLToPath(new URL('../dist/components/', import.meta.url))
const declaration = `import type { DefineComponent } from 'vue'\ndeclare const component: DefineComponent<Record<string, unknown>>\nexport default component\n`

for (const file of await readdir(sourceDirectory)) {
  if (file.endsWith('.vue')) {
    await writeFile(join(outputDirectory, `${file}.d.ts`), declaration)
  }
}

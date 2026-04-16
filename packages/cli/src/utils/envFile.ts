import fs from 'fs'

export class EnvFile {
  constructor(private path: string) {}

  private readFile = (): Record<string, string> => {
    if (!fs.existsSync(this.path)) return {}
    const content = fs.readFileSync(this.path, 'utf-8')
    const env: Record<string, string> = {}
    content.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        env[key.trim()] = valueParts.join('=').trim()
      }
    })
    return env
  }

  private writeFile = (env: Record<string, string>) => {
    const content = Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
    fs.writeFileSync(this.path, content)
  }

  get = (key: string): string | undefined => this.readFile()[key]

  set = (key: string, value: string) => {
    const env = this.readFile()
    env[key] = value
    this.writeFile(env)
  }
}

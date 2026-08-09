interface OdbEnv {
  read(name: string): string
  read(name: string, defaultValue: string): string
}

export const odbEnv: OdbEnv = {
  read(name, defaultValue?: string) {
    const value = process.env[name]

    if (value) return value
    if (defaultValue !== undefined) return defaultValue

    throw new Error(`${name} environment variable is not set`)
  },
}

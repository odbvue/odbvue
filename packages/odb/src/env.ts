interface OdbEnv {
  read(name: string): string
  read(name: string, defaultValue: string): string
  readonly appUsername: string
  readonly appPassword: string
  readonly schemaUsername: string
  readonly schemaPassword: string
}

export const odbEnv: OdbEnv = {
  read(name, defaultValue?: string) {
    const value = process.env[name]

    if (value) return value
    if (defaultValue !== undefined) return defaultValue

    throw new Error(`${name} environment variable is not set`)
  },
  get appUsername() {
    return odbEnv.read('ODBVUE_APP_ADMIN_USERNAME')
  },
  get appPassword() {
    return odbEnv.read('ODBVUE_APP_ADMIN_PASSWORD')
  },
  get schemaUsername() {
    return odbEnv.read('ODBVUE_ADB_SCHEMA_USERNAME')
  },
  get schemaPassword() {
    return odbEnv.read('ODBVUE_ADB_SCHEMA_PASSWORD')
  },
}

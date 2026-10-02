import { odbType } from '../../schema/package.js'

export const authTypes = {
  username: odbType.string(128),
  password: odbType.string(512),
  accessToken: odbType.string(4000),
  refreshToken: odbType.string(512),
  userId: odbType.guid(),
  displayName: odbType.string(256),
}

export interface OdbAuthOptions {
  jwtSecret?: string
}

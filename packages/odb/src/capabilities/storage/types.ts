import { odbType } from '../../schema/package.js'

export const storageTypes = {
  id: odbType.guid(),
  ownerId: odbType.string(32),
  fileName: odbType.string(255),
  mimeType: odbType.string(200),
  fileSize: odbType.number(),
  content: odbType.blob(),
  meta: odbType.json(),
}

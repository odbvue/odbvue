import { odbType } from '../../schema/package.js'
import { SUBJECT_HASH_LENGTH } from './constants.js'

export const rateLimitTypes = {
  scope: odbType.string(),
  subject: odbType.string(),
  subjectHash: odbType.string(SUBJECT_HASH_LENGTH),
}

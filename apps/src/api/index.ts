import { Schema } from '@odbvue/db'

import { crmPersons } from './tables/crmPersons'
import { appUsers } from './tables/appUsers'

export const schema = new Schema('odbvue').addTable(crmPersons).addTable(appUsers)

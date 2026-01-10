import { Schema } from '../../../apis/schema'
import { crmPersons } from './tables/crm-persons'
import { crmPackage } from './packages/crm'

export const schema = new Schema('odbvue')
export const tables = [crmPersons]
export const packages = [crmPackage]

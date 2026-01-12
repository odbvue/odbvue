import { Schema } from '../../../apis/schema'
import { crmPersons } from './tables/crm-persons'
import { crmProducts } from './tables/crm-products'
import { crmPackage } from './packages/crm'

export const schema = new Schema('odbvue')
export const tables = [crmPersons, crmProducts]
export const packages = [crmPackage]

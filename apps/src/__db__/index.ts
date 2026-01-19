export { Schema } from './ddl/schema.js'
export {
  Entity,
  type AttributeOptions,
  type AttributeType,
  type EntityOptions,
  type SqlStatement,
} from './ddl/table.js'
// Backwards compatibility aliases
export { Entity as Table } from './ddl/table.js'
export type { AttributeOptions as ColumnOptions, AttributeType as ColumnType } from './ddl/table.js'
export { Package, ParamType, Procedure } from './ddl/package.js'
export { Method, type MethodParamType, type MethodParams, type MethodInfo } from './ddl/method.js'
export { Service, type ServiceOptions, type ServiceInfo } from './ddl/service.js'
export { Query } from './dml/query.js'
export { Insert } from './dml/insert.js'
export { Update } from './dml/update.js'
export { Upsert } from './dml/upsert.js'

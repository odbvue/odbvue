import {
  PlsqlExpression,
  PlsqlStatement,
  renderPlsql,
  type PlsqlRenderable,
} from '../../schema/attribute.js'

function method<T extends string>(
  type: T,
  value: PlsqlRenderable,
  name: string,
  ...args: PlsqlRenderable[]
): PlsqlExpression<T> {
  return new PlsqlExpression(
    type,
    `${renderPlsql(value)}.${name}(${args.map(renderPlsql).join(', ')})`,
  )
}

/** Oracle's in-memory JSON types, distinct from SQL JSON_VALUE expressions. */
export const odbJson = {
  object: { type: 'JSON_OBJECT_T' } as const,
  array: { type: 'JSON_ARRAY_T' } as const,
  element: { type: 'JSON_ELEMENT_T' } as const,
  keyList: { type: 'JSON_KEY_LIST' } as const,

  parse(document: PlsqlRenderable): PlsqlExpression<'JSON_OBJECT_T'> {
    return new PlsqlExpression('JSON_OBJECT_T', `JSON_OBJECT_T.PARSE(${renderPlsql(document)})`)
  },
  asObject(element: PlsqlRenderable): PlsqlExpression<'JSON_OBJECT_T'> {
    return new PlsqlExpression('JSON_OBJECT_T', `TREAT(${renderPlsql(element)} AS JSON_OBJECT_T)`)
  },
  onError(value: PlsqlRenderable, mode: PlsqlRenderable): PlsqlStatement {
    return new PlsqlStatement(`${renderPlsql(value)}.on_error(${renderPlsql(mode)})`)
  },
  has(object: PlsqlRenderable, key: PlsqlRenderable): PlsqlExpression<'BOOLEAN'> {
    return method('BOOLEAN', object, 'has', key)
  },
  getKeys(object: PlsqlRenderable): PlsqlExpression<'JSON_KEY_LIST'> {
    return method('JSON_KEY_LIST', object, 'get_keys')
  },
  keyAt(keys: PlsqlRenderable, index: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression('VARCHAR2', `${renderPlsql(keys)}(${renderPlsql(index)})`)
  },
  get(value: PlsqlRenderable, key: PlsqlRenderable): PlsqlExpression<'JSON_ELEMENT_T'> {
    return method('JSON_ELEMENT_T', value, 'get', key)
  },
  getString(value: PlsqlRenderable, key: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return method('VARCHAR2', value, 'get_string', key)
  },
  getNumber(object: PlsqlRenderable, key: PlsqlRenderable): PlsqlExpression<'NUMBER'> {
    return method('NUMBER', object, 'get_number', key)
  },
  getBoolean(object: PlsqlRenderable, key: PlsqlRenderable): PlsqlExpression<'BOOLEAN'> {
    return method('BOOLEAN', object, 'get_boolean', key)
  },
  getArray(object: PlsqlRenderable, key: PlsqlRenderable): PlsqlExpression<'JSON_ARRAY_T'> {
    return method('JSON_ARRAY_T', object, 'get_array', key)
  },
  getSize(array: PlsqlRenderable): PlsqlExpression<'NUMBER'> {
    return method('NUMBER', array, 'get_size')
  },
  isNull(element: PlsqlRenderable): PlsqlExpression<'BOOLEAN'> {
    return method('BOOLEAN', element, 'is_null')
  },
  isString(element: PlsqlRenderable): PlsqlExpression<'BOOLEAN'> {
    return method('BOOLEAN', element, 'is_string')
  },
  isNumber(element: PlsqlRenderable): PlsqlExpression<'BOOLEAN'> {
    return method('BOOLEAN', element, 'is_number')
  },
  isBoolean(element: PlsqlRenderable): PlsqlExpression<'BOOLEAN'> {
    return method('BOOLEAN', element, 'is_boolean')
  },
  isArray(element: PlsqlRenderable): PlsqlExpression<'BOOLEAN'> {
    return method('BOOLEAN', element, 'is_array')
  },
  isObject(element: PlsqlRenderable): PlsqlExpression<'BOOLEAN'> {
    return method('BOOLEAN', element, 'is_object')
  },
}

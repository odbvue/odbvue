/** A typed key for a service owned by an OdbVue runtime. */
export interface OdbVueContract<_T> {
  readonly key: symbol
}

/** Defines a typed runtime service contract. */
export function defineContract<T>(name: string): OdbVueContract<T> {
  return { key: Symbol(name) }
}

export type MigrationDirection = 'up' | 'down'

export type MigrationCatalogEntry = {
  id: string
  tag?: string
}

export type MigrationPlanStep = MigrationCatalogEntry & {
  direction: MigrationDirection
}

export type MigrationPlan = {
  direction: MigrationDirection | null
  currentId: string | null
  targetId: string | null
  steps: MigrationPlanStep[]
}

export type PlanMigrationsOptions = {
  direction?: MigrationDirection
  target?: string
}

const resolveTargetIndex = (
  migrations: readonly MigrationCatalogEntry[],
  target: string,
): number => {
  if (target === 'base') return -1
  if (target === 'latest') return migrations.length - 1

  const index = migrations.findIndex((migration) => migration.tag === target)
  if (index === -1) throw new Error(`Unknown migration target "${target}"`)
  return index
}

const validateCatalog = (migrations: readonly MigrationCatalogEntry[]): void => {
  const ids = new Set<string>()
  const tags = new Set<string>()

  for (const migration of migrations) {
    if (ids.has(migration.id)) throw new Error(`Duplicate migration ID "${migration.id}"`)
    ids.add(migration.id)

    if (!migration.tag) continue
    if (migration.tag === 'base' || migration.tag === 'latest') {
      throw new Error(`Migration ${migration.id} uses reserved tag "${migration.tag}"`)
    }
    if (tags.has(migration.tag)) throw new Error(`Duplicate migration tag "${migration.tag}"`)
    tags.add(migration.tag)
  }
}

const validateAppliedPrefix = (
  migrations: readonly MigrationCatalogEntry[],
  appliedIds: readonly string[],
): void => {
  if (appliedIds.length > migrations.length) {
    throw new Error('Applied migrations are not a prefix of the local catalog')
  }

  for (let index = 0; index < appliedIds.length; index++) {
    if (appliedIds[index] !== migrations[index].id) {
      throw new Error(
        `Applied migration "${appliedIds[index]}" does not match local migration "${migrations[index].id}" at position ${index + 1}`,
      )
    }
  }
}

export const planMigrations = (
  migrations: readonly MigrationCatalogEntry[],
  appliedIds: readonly string[],
  options: PlanMigrationsOptions = {},
): MigrationPlan => {
  validateCatalog(migrations)
  validateAppliedPrefix(migrations, appliedIds)

  const currentIndex = appliedIds.length - 1
  let targetIndex: number

  if (options.target) {
    targetIndex = resolveTargetIndex(migrations, options.target)
  } else if (options.direction === 'up') {
    targetIndex = Math.min(currentIndex + 1, migrations.length - 1)
  } else if (options.direction === 'down') {
    targetIndex = Math.max(currentIndex - 1, -1)
  } else {
    throw new Error('A migration direction or target is required')
  }

  const inferredDirection: MigrationDirection | null =
    targetIndex > currentIndex ? 'up' : targetIndex < currentIndex ? 'down' : null

  if (options.direction && inferredDirection && options.direction !== inferredDirection) {
    throw new Error(
      `Target "${options.target}" is ${inferredDirection === 'up' ? 'ahead of' : 'behind'} the current migration`,
    )
  }

  const steps: MigrationPlanStep[] = []
  if (inferredDirection === 'up') {
    for (let index = currentIndex + 1; index <= targetIndex; index++) {
      steps.push({ ...migrations[index], direction: 'up' })
    }
  } else if (inferredDirection === 'down') {
    for (let index = currentIndex; index > targetIndex; index--) {
      steps.push({ ...migrations[index], direction: 'down' })
    }
  }

  return {
    direction: inferredDirection,
    currentId: migrations[currentIndex]?.id ?? null,
    targetId: migrations[targetIndex]?.id ?? null,
    steps,
  }
}

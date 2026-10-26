import { type PackageImpl, odbType } from '../../../schema/package.js'
import { cond, odbLiteral } from '../../../schema/attribute.js'
import { odbSettings } from '../../settings/settings.js'
import { authPolicySettings } from '../settings.js'

export function defineAuthPolicy(pkg: PackageImpl) {
  const featureEnabled = pkg.func('enabled', odbType.boolean(), (fn) => {
    const { feature } = fn.parameters({ in: { feature: odbType.string(32) } })
    fn.body((body) => {
      const { id, value, meta } = body.variables({
        id: odbType.string(64),
        value: odbSettings.types.value,
        meta: odbSettings.types.meta,
      })
      for (const [name, setting] of authPolicySettings)
        body.ifThen(cond.eq(feature, name), (match) => match.set(id, odbLiteral(setting)))
      body.ifThen(cond.isNull(id), (invalid) => invalid.invalid('AUTH_FEATURE_INVALID'))
      body.call(odbSettings.read(id, value, meta))
      body.ifThen(
        cond.or([cond.isNull(value), cond.and([cond.ne(value, 'Y'), cond.ne(value, 'N')])]),
        (invalid) => invalid.invalid('AUTH_CONFIG_INVALID'),
      )
      body.return(cond.eq(value, 'Y'))
    })
  })

  return { featureEnabled }
}

import { type PackageImpl, odbType } from '../../../../schema/package.js'
import { cond, odbLiteral } from '../../../../schema/attribute.js'
import { odbQuery } from '../../../../query/index.js'
import { odbDbmsLob, odbOracle } from '../../../../oracle/index.js'
import { odbLob } from '../../../../helpers/lob/lob.js'
import { odbStorage } from '../../../storage/storage.js'
import { authUsers } from '../../core/tables/users.js'
import { authIdentities } from '../../core/tables/identities.js'

export function defineAuthProfile(pkg: PackageImpl) {
  const readProfile = pkg.proc(
    'read_profile',
    {
      in: { userId: authUsers.id },
      out: {
        avatarUrl: odbType.clob(),
        avatarUploaded: odbType.integer(),
        passwordConnected: odbType.integer(),
        googleConnected: odbType.integer(),
        avatarId: authUsers.avatar,
      },
    },
    ({
      params: { userId, avatarUrl, avatarUploaded, passwordConnected, googleConnected, avatarId },
      body,
    }) => {
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select([
            authUsers.googleAvatarUrl,
            odbOracle.caseWhen(
              cond.isNull(authUsers.avatar),
              odbLiteral(0),
              odbLiteral(1),
              'NUMBER',
            ),
            authUsers.avatar,
          ])
          .into(avatarUrl, avatarUploaded, avatarId)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)])),
      )
      body.query(
        odbQuery()
          .selectFrom(authIdentities)
          .select([
            odbOracle.count(
              odbOracle.caseWhen(
                cond.eq(authIdentities.issuer, 'password'),
                odbLiteral(1),
                odbOracle.null(),
                'NUMBER',
              ),
            ),
            odbOracle.count(
              odbOracle.caseWhen(
                cond.eq(authIdentities.issuer, 'https://accounts.google.com'),
                odbLiteral(1),
                odbOracle.null(),
                'NUMBER',
              ),
            ),
          ])
          .into(passwordConnected, googleConnected)
          .where(cond.eq(authIdentities.userId, userId)),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.notFound())
    },
  )

  const updateAvatar = pkg.proc(
    'update_avatar',
    { in: { userId: authUsers.id, avatar: odbType.clob() } },
    ({ params: { userId, avatar }, body }) => {
      const { previousAvatar, avatarId, content } = body.variables({
        previousAvatar: authUsers.avatar,
        avatarId: authUsers.avatar,
        content: odbType.blob(),
      })
      body.ifThen(cond.isNotNull(avatar), (validate) => {
        validate.ifThen(
          cond.or([
            cond.gt(odbDbmsLob.getLength(avatar), 30000),
            cond.lt(odbDbmsLob.getLength(avatar), 31),
            cond.not(
              cond.regexpLike(
                avatar,
                '^data:image/jpeg;base64,/9j/([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',
                'c',
              ),
            ),
          ]),
          (then) => then.invalid('PROFILE_AVATAR_INVALID'),
        )
        validate.set(content, odbLob.base64ToBlob(odbDbmsLob.substr(avatar, 30000, 24)))
        validate.ifThen(
          cond.ne(odbOracle.rawToHex(odbDbmsLob.substrRaw(content, 3, 1)), 'FFD8FF'),
          (then) => then.invalid('PROFILE_AVATAR_INVALID'),
        )
      })
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.avatar)
          .into(previousAvatar)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)]))
          .forUpdate(),
      )
      body.ifThen(cond.isNotNull(content), (then) => {
        then.call(
          odbStorage.write(
            userId,
            odbLiteral('avatar.jpg'),
            odbLiteral('image/jpeg'),
            content,
            odbLiteral('{"purpose":"avatar"}'),
            avatarId,
          ),
        )
      })
      body.query(
        odbQuery()
          .updateTable(authUsers)
          .set({ avatar: avatarId, updatedAt: odbOracle.sysTimestamp() })
          .where(cond.eq(authUsers.id, userId)),
      )
      body.ifThen(cond.isNotNull(previousAvatar), (then) =>
        then.call(odbStorage.remove(userId, previousAvatar)),
      )
      body.ifThen(cond.eq(odbDbmsLob.isTemporary(content), 1), (then) =>
        then.call(odbDbmsLob.freeTemporary(content)),
      )
      body.when('NO_DATA_FOUND', (handler) => handler.notFound())
    },
  )

  return { readProfile, updateAvatar }
}

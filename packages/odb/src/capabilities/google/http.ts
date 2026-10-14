import { cond, odbLiteral, plsqlExpr } from '../../schema/attribute.js'
import { odbType, PlsqlException, type PackageImpl } from '../../schema/package.js'
import { odbDbmsLob, odbOracle, odbUtlHttp, odbUtlI18n, odbUtlRaw } from '../../oracle/index.js'

export function defineGoogleHttp(pkg: PackageImpl) {
  return pkg.privateFunc('request_json', odbType.clob(), (fn) => {
    const { url, method, payload } = fn.parameters({
      in: { url: odbType.string(2048), method: odbType.string(8), payload: odbType.string(32767) },
    })
    fn.body((body) => {
      const {
        context,
        request,
        response,
        open,
        piece,
        bytes,
        blob,
        result,
        total,
        dest,
        src,
        lang,
        warning,
        priorTimeout,
        timeoutChanged,
      } = body.variables({
        context: odbUtlHttp.context,
        request: odbUtlHttp.request,
        response: odbUtlHttp.response,
        open: odbType.boolean(),
        piece: odbType.raw(8192),
        bytes: odbType.raw(32767),
        blob: odbType.blob(),
        result: odbType.clob(),
        total: odbType.integer(),
        dest: odbType.integer(),
        src: odbType.integer(),
        lang: odbType.integer(),
        warning: odbType.integer(),
        priorTimeout: odbType.integer(),
        timeoutChanged: odbType.boolean(),
      })
      const invalid = new PlsqlException('VALUE_ERROR')
      body.set(open, false)
      body.set(timeoutChanged, false)
      body.set(total, 0)
      body.set(dest, 1)
      body.set(src, 1)
      body.set(lang, 0)
      body.ifThen(
        cond.and([
          cond.ne(url, 'https://oauth2.googleapis.com/token'),
          cond.ne(url, 'https://www.googleapis.com/oauth2/v3/certs'),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(context, odbUtlHttp.createRequestContext(false))
      body.call(odbUtlHttp.getTransferTimeout(priorTimeout))
      body.set(timeoutChanged, true)
      body.call(odbUtlHttp.setTransferTimeout(odbLiteral(10)))
      body.set(request, odbUtlHttp.beginRequest(url, method, odbLiteral('HTTP/1.1'), context))
      body.call(odbUtlHttp.setFollowRedirect(request, odbLiteral(0)))
      body.call(odbUtlHttp.setHeader(request, odbLiteral('Accept'), odbLiteral('application/json')))
      body.ifThen(cond.eq(method, 'POST'), (then) => {
        then.set(bytes, odbUtlI18n.stringToRaw(payload, odbLiteral('AL32UTF8')))
        then.call(
          odbUtlHttp.setHeader(
            request,
            odbLiteral('Content-Type'),
            odbLiteral('application/x-www-form-urlencoded'),
          ),
        )
        then.call(
          odbUtlHttp.setHeader(
            request,
            odbLiteral('Content-Length'),
            odbOracle.toChar(odbUtlRaw.length(bytes), odbLiteral('FM999999')),
          ),
        )
        then.call(odbUtlHttp.writeRaw(request, bytes))
      })
      body.set(response, odbUtlHttp.getResponse(request))
      body.set(open, true)
      body.ifThen(cond.ne(response.field('status_code', 'NUMBER'), 200), (then) =>
        then.raise(invalid),
      )
      body.call(odbDbmsLob.createTemporary(blob, true, odbDbmsLob.CALL))
      body.block((read) => {
        read.while(cond.eq(odbLiteral(1), 1), (loop) => {
          loop.call(odbUtlHttp.readRaw(response, piece, odbLiteral(8192)))
          loop.set(total, plsqlExpr.add(total, odbUtlRaw.length(piece)))
          loop.ifThen(cond.gt(total, 65536), (then) => then.raise(invalid))
          loop.call(odbDbmsLob.writeAppend(blob, odbUtlRaw.length(piece), piece))
        })
        read.when(odbUtlHttp.END_OF_BODY, (done) => done.null())
      })
      body.call(odbUtlHttp.endResponse(response))
      body.set(open, false)
      body.call(odbUtlHttp.setTransferTimeout(priorTimeout))
      body.set(timeoutChanged, false)
      body.ifThen(cond.isNotNull(context), (then) =>
        then.call(odbUtlHttp.destroyRequestContext(context)),
      )
      body.set(context, null)
      body.call(odbDbmsLob.createTemporary(result, true, odbDbmsLob.CALL))
      body.call(
        odbDbmsLob.convertToClob(
          result,
          blob,
          odbDbmsLob.LOBMAXSIZE,
          dest,
          src,
          odbOracle.nlsCharsetId(odbLiteral('AL32UTF8')),
          lang,
          warning,
        ),
      )
      body.ifThen(cond.ne(warning, 0), (then) => then.raise(invalid))
      body.call(odbDbmsLob.freeTemporary(blob))
      body.return(result)
      body.when('OTHERS', (handler) => {
        // Cleanup failures must not replace the original, sanitized HTTP failure.
        for (const [condition, statement] of [
          [cond.eq(open, true), odbUtlHttp.endResponse(response)],
          [cond.isNotNull(context), odbUtlHttp.destroyRequestContext(context)],
          [cond.eq(timeoutChanged, true), odbUtlHttp.setTransferTimeout(priorTimeout)],
        ] as const) {
          handler.ifThen(condition, (then) =>
            then.block((cleanup) => {
              cleanup.call(statement)
              cleanup.when('OTHERS', (ignored) => ignored.null())
            }),
          )
        }
        for (const lob of [blob, result]) {
          handler.ifThen(cond.eq(odbDbmsLob.isTemporary(lob), 1), (then) =>
            then.call(odbDbmsLob.freeTemporary(lob)),
          )
        }
        handler.block((log) => {
          log.auditError('GOOGLE_HTTP_FAILURE')
          log.when('OTHERS', (ignored) => ignored.null())
        })
        handler.unauthorized('GOOGLE_HTTP_FAILURE')
      })
    })
  })
}

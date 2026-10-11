import { cond, odbLiteral, plsqlExpr, type PlsqlValue } from '../../schema/attribute.js'
import {
  odbPackage,
  odbType,
  type OdbTypeDescriptor,
  type ProcedureBody,
} from '../../schema/package.js'
import { odbDbmsLob, odbOracle, odbUtlEncode, odbUtlRaw } from '../../oracle/index.js'

function convert(
  body: ProcedureBody,
  source: PlsqlValue,
  charsetId: PlsqlValue,
  errorOnWarning: PlsqlValue,
  resultType: OdbTypeDescriptor<'BLOB' | 'CLOB'>,
  conversion: typeof odbDbmsLob.convertToBlob,
): void {
  const { result, destinationOffset, sourceOffset, languageContext, warning } = body.variables({
    result: resultType,
    destinationOffset: odbType.custom('INTEGER'),
    sourceOffset: odbType.custom('INTEGER'),
    languageContext: odbType.custom('INTEGER'),
    warning: odbType.custom('INTEGER'),
  })
  destinationOffset.initialize(1)
  sourceOffset.initialize(1)
  languageContext.initialize(odbDbmsLob.DEFAULT_LANG_CTX)
  body.call(odbDbmsLob.createTemporary(result, true, odbDbmsLob.CALL))
  body.call(
    conversion(
      result,
      source,
      odbDbmsLob.LOBMAXSIZE,
      destinationOffset,
      sourceOffset,
      charsetId,
      languageContext,
      warning,
    ),
  )
  body.ifThen(
    cond.and([cond.ne(warning, odbDbmsLob.NO_WARNING), cond.eq(errorOnWarning, 1)]),
    (then) =>
      then.raiseApplicationError(
        -20001,
        plsqlExpr.concat(
          'Error during lob conversion : ',
          odbOracle.caseWhen(
            cond.eq(warning, odbDbmsLob.WARN_INCONVERTIBLE_CHAR),
            odbLiteral('Inconvertible character'),
            plsqlExpr.concat('Warning code ', warning),
            'VARCHAR2',
          ),
        ),
      ),
  )
  body.return(result)
}

// Chunked Base64 algorithm adapted from https://github.com/paulzip-dev/Base64.
export const odbLobPackage = odbPackage('odb_lob', (pkg) => {
  const flag = pkg.subtype('boolean', odbType.integer(), [0, 1])
  const crlf = pkg.privateConstant('c_crlf', odbType.string(2), {
    value: plsqlExpr.concat(odbOracle.chr(13), odbOracle.chr(10)),
  })
  const whitespace = pkg.privateConstant('c_whitespace', odbType.string(6), {
    value: plsqlExpr.concat(' ', ...[13, 10, 9, 11, 12].map((code) => odbOracle.chr(code))),
  })
  const maxEncode = pkg.privateConstant('c_max_enc_chunk_len', odbType.integer(), { value: 23760 })
  const maxDecode = pkg.privateConstant('c_max_dec_chunk_len', odbType.integer(), { value: 31680 })

  const removeWhitespace = pkg.privateFunc('remove_whitespace', odbType.string(), (fn) => {
    const { value } = fn.parameters({ in: { value: odbType.string() } })
    fn.body((body) =>
      body.return(odbOracle.translate(value, plsqlExpr.concat('a', whitespace), odbLiteral('a'))),
    )
  })

  const decodeRaw = pkg.privateFunc('decode_raw', odbType.raw(), (fn) => {
    const { value, removeWhitespace: remove } = fn.parameters({
      in: {
        value: odbType.string(),
        removeWhitespace: { ...flag, default: odbLiteral(1) },
      },
    })
    fn.body((body) => {
      body.ifThen(cond.isNull(value), (then) => then.return(null))
      body.return(
        odbUtlEncode.base64Decode(
          odbUtlRaw.castToRaw(
            odbOracle.caseWhen(
              cond.eq(remove, 0),
              value,
              removeWhitespace.invoke(value),
              'VARCHAR2',
            ),
          ),
        ),
      )
    })
  })

  const encodeRaw = pkg.privateFunc('encode_raw', odbType.string(), (fn) => {
    const { value, newline } = fn.parameters({
      in: { value: odbType.raw(), newline: { ...flag, default: odbLiteral(1) } },
    })
    fn.body((body) => {
      body.ifThen(cond.isNull(value), (then) => then.return(null))
      const encoded = odbUtlRaw.castToVarchar2(odbUtlEncode.base64Encode(value))
      body.return(
        odbOracle.caseWhen(
          cond.eq(newline, 0),
          odbOracle.replace(encoded, crlf, odbLiteral('')),
          odbOracle.rtrim(encoded, crlf),
          'VARCHAR2',
        ),
      )
    })
  })

  const clobToBlob = pkg.func('clob_to_blob', odbType.blob(), (fn) => {
    const { clob, charsetId, errorOnWarning } = fn.parameters({
      in: {
        clob: odbType.clob(),
        charsetId: { ...odbType.custom('INTEGER'), default: odbDbmsLob.DEFAULT_CSID },
        errorOnWarning: { ...flag, default: odbLiteral(0) },
      },
    })
    fn.body((body) =>
      convert(body, clob, charsetId, errorOnWarning, odbType.blob(), odbDbmsLob.convertToBlob),
    )
  })

  const blobToClob = pkg.func('blob_to_clob', odbType.clob(), (fn) => {
    const { blob, charsetId, errorOnWarning } = fn.parameters({
      in: {
        blob: odbType.blob(),
        charsetId: { ...odbType.custom('INTEGER'), default: odbDbmsLob.DEFAULT_CSID },
        errorOnWarning: { ...flag, default: odbLiteral(0) },
      },
    })
    fn.body((body) =>
      convert(body, blob, charsetId, errorOnWarning, odbType.clob(), odbDbmsLob.convertToClob),
    )
  })

  const blobToBase64 = pkg.func('blob_to_base64', odbType.clob(), (fn) => {
    const { blob, newline } = fn.parameters({
      in: { blob: odbType.blob(), newline: { ...flag, default: odbLiteral(1) } },
    })
    fn.body((body) => {
      const { length, offset, chunk, separator, result } = body.variables({
        length: odbType.custom('INTEGER'),
        offset: odbType.custom('INTEGER'),
        chunk: odbType.string(32767),
        separator: odbType.string(2),
        result: odbType.clob(),
      })
      length.initialize(odbOracle.nvl(odbDbmsLob.getLength(blob), odbLiteral(0)))
      offset.initialize(1)
      separator.initialize(
        odbOracle.caseWhen(cond.eq(newline, 0), odbOracle.null(), crlf, 'VARCHAR2'),
      )
      body.ifThen(cond.eq(length, 0), (then) =>
        then.return(
          odbOracle.caseWhen(cond.isNull(blob), odbOracle.null(), odbOracle.emptyClob(), 'CLOB'),
        ),
      )
      body.ifThen(cond.lte(length, maxEncode), (then) =>
        then.return(
          odbOracle.toClob(encodeRaw.invoke(odbDbmsLob.substrRaw(blob, maxEncode), newline)),
        ),
      )
      body.call(odbDbmsLob.createTemporary(result, true, odbDbmsLob.CALL))
      body.forRange(
        'chunkIndex',
        1,
        odbOracle.ceil(plsqlExpr.divide(length, maxEncode)),
        (index, loop) => {
          loop.set(
            chunk,
            plsqlExpr.concat(
              odbOracle.caseWhen(cond.gt(index, 1), separator, odbOracle.null(), 'VARCHAR2'),
              encodeRaw.invoke(odbDbmsLob.substrRaw(blob, maxEncode, offset), newline),
            ),
          )
          loop.call(odbDbmsLob.writeAppend(result, odbOracle.length(chunk), chunk))
          loop.set(offset, plsqlExpr.add(offset, maxEncode))
        },
      )
      body.return(result)
    })
  })

  const clobToBase64 = pkg.func('clob_to_base64', odbType.clob(), (fn) => {
    const { clob, newline } = fn.parameters({
      in: { clob: odbType.clob(), newline: { ...flag, default: odbLiteral(1) } },
    })
    fn.body((body) => {
      body.ifThen(cond.or([cond.isNull(clob), cond.eq(odbDbmsLob.getLength(clob), 0)]), (then) =>
        then.return(clob),
      )
      body.return(blobToBase64.invoke(clobToBlob.invoke(clob), newline))
    })
  })

  const varchar2ToBase64 = pkg.func('varchar2_to_base64', odbType.clob(), (fn) => {
    const { varchar2, newline } = fn.parameters({
      in: { varchar2: odbType.string(), newline: { ...flag, default: odbLiteral(1) } },
    })
    fn.body((body) =>
      body.return(odbOracle.toClob(encodeRaw.invoke(odbUtlRaw.castToRaw(varchar2), newline))),
    )
  })

  const base64ToBlob = pkg.func('base64_to_blob', odbType.blob(), (fn) => {
    const { base64 } = fn.parameters({ in: { base64: odbType.clob() } })
    fn.body((body) => {
      const { offset, length, buffer, modulo, overflow, bufferLength, amount, result } =
        body.variables({
          offset: odbType.custom('INTEGER'),
          length: odbType.custom('INTEGER'),
          buffer: odbType.string(32767),
          modulo: odbType.number(),
          overflow: odbType.string(4),
          bufferLength: odbType.number(),
          amount: odbType.integer(),
          result: odbType.blob(),
        })
      offset.initialize(1)
      length.initialize(odbOracle.nvl(odbDbmsLob.getLength(base64), odbLiteral(0)))
      amount.initialize(maxDecode)

      const appendChunk = body.localProc('append_chunk', (proc) => {
        const { chunk } = proc.parameters({ in: { chunk: odbType.string() } })
        proc.body((append) => {
          const { raw } = append.variables({ raw: odbType.raw(32767) })
          append.set(raw, decodeRaw.invoke(chunk, odbLiteral(0)))
          append.ifThen(cond.isNotNull(raw), (then) =>
            then.call(odbDbmsLob.writeAppend(result, odbUtlRaw.length(raw), raw)),
          )
        })
      })

      body.ifThen(cond.eq(length, 0), (then) =>
        then.return(
          odbOracle.caseWhen(cond.isNull(base64), odbOracle.null(), odbOracle.emptyBlob(), 'BLOB'),
        ),
      )
      body.ifThen(cond.lte(length, maxDecode), (then) =>
        then.return(odbOracle.toBlob(decodeRaw.invoke(base64))),
      )
      body.call(odbDbmsLob.createTemporary(result, false, odbDbmsLob.CALL))
      body.while(cond.lte(offset, length), (loop) => {
        loop.call(odbDbmsLob.read(base64, amount, offset, buffer))
        // Carry belongs to the combined buffer, including when this chunk has no remainder.
        loop.set(buffer, plsqlExpr.concat(overflow, removeWhitespace.invoke(buffer)))
        loop.set(bufferLength, odbOracle.nvl(odbOracle.length(buffer), odbLiteral(0)))
        loop.set(modulo, odbOracle.mod(bufferLength, 4))
        loop.call(
          appendChunk.invoke(odbOracle.substr(buffer, 1, plsqlExpr.subtract(bufferLength, modulo))),
        )
        loop.set(
          overflow,
          odbOracle.caseWhen(
            cond.gt(modulo, 0),
            odbOracle.substr(buffer, plsqlExpr.subtract(0, modulo)),
            odbOracle.null(),
            'VARCHAR2',
          ),
        )
        loop.set(offset, plsqlExpr.add(offset, amount))
      })
      body.ifThen(cond.isNotNull(overflow), (then) => then.call(appendChunk.invoke(overflow)))
      body.return(result)
    })
  })

  const base64ToVarchar2 = pkg.func('base64_to_varchar2', odbType.string(), (fn) => {
    const { base64 } = fn.parameters({ in: { base64: odbType.clob() } })
    fn.body((body) => body.return(odbUtlRaw.castToVarchar2(decodeRaw.invoke(base64))))
  })

  const base64ToClob = pkg.func('base64_to_clob', odbType.clob(), (fn) => {
    const { base64 } = fn.parameters({ in: { base64: odbType.clob() } })
    fn.body((body) => {
      const { length } = body.variables({ length: odbType.custom('INTEGER') })
      length.initialize(odbOracle.nvl(odbDbmsLob.getLength(base64), odbLiteral(0)))
      body.ifThen(cond.eq(length, 0), (then) => then.return(base64))
      body.ifThen(cond.lte(length, maxDecode), (then) =>
        then.return(odbOracle.toClob(base64ToVarchar2.invoke(base64))),
      )
      body.return(blobToClob.invoke(base64ToBlob.invoke(base64)))
    })
  })

  return {
    clobToBlob,
    blobToClob,
    blobToBase64,
    clobToBase64,
    varchar2ToBase64,
    base64ToBlob,
    base64ToClob,
    base64ToVarchar2,
  }
})

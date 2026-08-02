# Oracle Packages

OdbVue provides typed TypeScript wrappers for Oracle's built-in PL/SQL packages. Use them to compose calls inside a package body without hand-writing PL/SQL strings. These packages ship with every Oracle database, so there is **no install step** — unlike odb [framework packages](./lob) such as `odb_lob`.

Each wrapper function returns a typed expression whose PL/SQL return type flows into `body.set()`, so mismatches are caught at compile time.

## `odbUtlRaw` — `UTL_RAW`

RAW manipulation, bitwise operations, and casts.

```ts
import { odbUtlRaw } from '@odbvue/odb'

odbUtlRaw.castToVarchar2('v_raw') // UTL_RAW.CAST_TO_VARCHAR2(v_raw)
odbUtlRaw.length('v_raw') // UTL_RAW.LENGTH(v_raw)
odbUtlRaw.substr('v_raw', 1, 4) // UTL_RAW.SUBSTR(v_raw, 1, 4)
odbUtlRaw.bitAnd('v_a', 'v_b') // UTL_RAW.BIT_AND(v_a, v_b)
odbUtlRaw.BIG_ENDIAN // UTL_RAW.BIG_ENDIAN (constant)
```

Includes casts (`castToRaw`, `castToNumber`, `castFromBinaryDouble`, …), `concat`, `copies`, `reverse`, `compare`, `convert`, `overlay`, `translate`/`transliterate`, `xrange`, and the endianess constants.

## `odbUtlEncode` — `UTL_ENCODE`

Base64, quoted-printable, and uuencode.

```ts
import { odbUtlEncode } from '@odbvue/odb'

odbUtlEncode.base64Encode('v_raw') // UTL_ENCODE.BASE64_ENCODE(v_raw)
odbUtlEncode.base64Decode('v_raw') // UTL_ENCODE.BASE64_DECODE(v_raw)
odbUtlEncode.textEncode('v_buf', undefined, odbUtlEncode.BASE64)
```

Also exposes `quotedPrintable*`, `uuEncode`/`uuDecode`, `textEncode`/`textDecode`, `mimeheaderEncode`/`mimeheaderDecode`, and the `BASE64` / `QUOTED_PRINTABLE` constants.

## `odbDbmsLob` — `DBMS_LOB`

LOB inspection functions and read/write procedures.

```ts
import { odbDbmsLob } from '@odbvue/odb'

// Functions return typed expressions:
odbDbmsLob.getLength('v_clob') // DBMS_LOB.GETLENGTH(v_clob)
odbDbmsLob.substr('v_clob', 100, 1) // → VARCHAR2
odbDbmsLob.instr('v_clob', 'v_pat') // → INTEGER

// Procedures return a call string for body.raw(...):
body.raw(odbDbmsLob.createTemporary('v_tmp', true, odbDbmsLob.SESSION))
body.raw(odbDbmsLob.append('v_dest', 'v_src'))
```

Functions (expressions): `getLength`, `getChunkSize`, `compare`, `instr`, `substr`/`substrRaw`, `isOpen`, `isTemporary`, `fileExists`, … Procedures (statement strings for `body.raw(...)`): `append`, `copy`, `createTemporary`, `freeTemporary`, `open`/`close`, `trim`, `erase`, `write`/`writeAppend`/`read`, and the `FILE*` helpers. Constants include `LOB_READONLY`, `LOB_READWRITE`, `SESSION`, `CALL`, and `LOBMAXSIZE`.

## `odbDbmsCrypto` — `DBMS_CRYPTO`

Hashing, MAC, symmetric and public-key encryption, sign/verify, and random generators.

```ts
import { odbDbmsCrypto } from '@odbvue/odb'

odbDbmsCrypto.hash('v_src', odbDbmsCrypto.HASH_SH256) // → RAW
odbDbmsCrypto.randomBytes(16) // → RAW

const typ = odbDbmsCrypto.cipherSuite(
  odbDbmsCrypto.ENCRYPT_AES256,
  odbDbmsCrypto.CHAIN_CBC,
  odbDbmsCrypto.PAD_PKCS5,
)
odbDbmsCrypto.encrypt('v_src', typ, 'v_key', 'v_iv') // → RAW
```

Functions: `hash`, `mac`, `encrypt`/`decrypt`, `pkEncrypt`/`pkDecrypt`, `sign`/`verify`, `randomBytes`/`randomInteger`/`randomNumber`. The `cipherSuite(...)` helper sums an encryption algorithm, chaining mode, and padding mode into a `typ` value. Constants cover `HASH_*`, `HMAC_*`, `ENCRYPT_*`, `CHAIN_*`, `PAD_*`, cipher suites, and public-key/sign algorithms.

## Example: hashing inside a package

```ts
import { odbDbmsCrypto, odbPackage } from '@odbvue/odb'

const secure = odbPackage('pck_secure', (pkg) => {
  pkg.func('sha256', 'RAW', (fn) => {
    const pData = fn.in('p_data', 'RAW')
    fn.body((body) => {
      body.return(odbDbmsCrypto.hash(pData, odbDbmsCrypto.HASH_SH256))
    })
  })
})
```

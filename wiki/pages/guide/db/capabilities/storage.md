# Storage

Storage keeps files in Oracle as BLOBs. `odbStorage` installs the `odb_storage_files` table and the `odb_storage` PL/SQL package, which provides owner-scoped `list`, `write`, `read`, and `remove` operations.

The capability is transport-independent. It does not define ORDS routes, authenticate callers, emit HTTP headers, or commit transactions. An application package owns those responsibilities.

## Install

```ts
import { defineMigration, odbStorage } from '@odbvue/odb'

export const migration = defineMigration('20261002120000_storage', {
  schema: process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? '',
}).install(odbStorage)
```

This installs the table before the package. Rollback drops the package and then the table, including all stored files.

Applications that expose the sandbox's Base64 upload path also install `odbLob`. The existing bootstrap migration already installs both capabilities.

## Data Model

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `CHAR(32)` | Generated lowercase hexadecimal file ID. |
| `owner_id` | `VARCHAR2(32)` | Owner supplied by the trusted caller. |
| `file_name` | `VARCHAR2(255)` | Trimmed filename, without directory separators or control characters. |
| `mime_type` | `VARCHAR2(200)` | Validated MIME type; defaults to `application/octet-stream` when NULL. |
| `file_size` | `NUMBER(19)` | Byte count calculated from the BLOB with `DBMS_LOB.GETLENGTH`. |
| `content` | `BLOB` | File bytes, including a non-NULL empty BLOB for an empty file. |
| `meta` | `CLOB` constrained to JSON | Free-form metadata; defaults to `{}`. |
| `created_at` | `TIMESTAMP(6)` | Database-generated creation timestamp. |

The table has a primary key on `id`, an index on `(owner_id, id)`, and a check limiting file size to 10 MiB. The list operation does not select file content.

## Capability API

The TypeScript helpers return typed PL/SQL calls for `body.call(...)`. Bare strings represent PL/SQL expressions; use `odbLiteral(...)` for literal values. Reuse `odbStorage.types` for procedure parameters and local variables.

| Helper | Parameters | Behavior |
| --- | --- | --- |
| `list` | `ownerId`, `after`, `limit`, `items` OUT | Lists one owner's file metadata, ordered by ID after `after`. |
| `write` | `ownerId`, `fileName`, `mimeType`, `content`, `id` OUT, optional `meta` | Creates a new file and returns its ID. It does not replace an existing file. |
| `read` | `ownerId`, `id`, `fileName` OUT, `mimeType` OUT, `fileSize` OUT, `content` OUT, `meta` OUT | Reads a file's BLOB and metadata. |
| `remove` | `ownerId`, `id` | Deletes a file belonging to that owner. |

```ts
body.call(odbStorage.write(ownerId, fileName, mimeType, content, id))
body.call(odbStorage.write(ownerId, fileName, mimeType, content, id, meta))
body.call(odbStorage.read(ownerId, id, fileName, mimeType, fileSize, content, meta))
body.call(odbStorage.list(ownerId, after, limit, items))
body.call(odbStorage.remove(ownerId, id))
```

The TypeScript `write` helper puts the OUT `id` before optional `meta` for convenience. The underlying PL/SQL signature puts all IN parameters first:

```sql
odb_storage.write(p_owner_id, p_file_name, p_mime_type, p_content, p_meta, p_id);
```

`meta` is validated as JSON but otherwise stored without interpretation. The capability does not infer a file extension or inspect bytes to verify the declared MIME type.

### Ownership

Every list, read, and delete is filtered by `owner_id`. Reading or deleting a missing file, including a file owned by somebody else, raises `STORAGE_FILE_NOT_FOUND`.

The capability trusts the supplied owner ID. This filter is not authentication: application services must obtain ownership from a trusted identity rather than accepting an arbitrary owner ID from the client.

The sandbox uses `auth: 'authenticated'` and `context: { userId: procedure.parameters.ownerId }`. The generated handler authenticates the bearer token and supplies the user ID without exposing `ownerId` as an HTTP input. Transactions remain the caller's responsibility.

### Pagination

```ts
body.call(odbStorage.list(ownerId, after, limit, items))
```

- `after = NULL` starts from the first page.
- `limit = NULL` uses 50 rows; explicit limits must be from 1 through 101.
- Rows are ordered by file ID, not creation time.
- Request one extra row to detect another page. For a page size of 50, request 51 rows, display the first 50, and use the last displayed ID as the next cursor when the extra row exists.

The result set contains `id`, `file_name`, `mime_type`, `file_size`, `meta`, and `created_at`. ORDS emits these cursor fields in snake case. The sandbox page maps them to camel case for display.

## Sandbox HTTP Contract

The sandbox migration exposes the following authenticated routes:

| Method | Route | Result |
| --- | --- | --- |
| `POST` | `/sandbox/storage` | Upload a file; returns JSON `{ "id": "..." }`. |
| `GET` | `/sandbox/storage?limit=51&cursor=...` | List the current user's files as `{ "items": [...] }`. Omit `cursor` for the first page. |
| `GET` | `/sandbox/storage/:id` | Download a binary attachment, not a JSON/Base64 response. |
| `DELETE` | `/sandbox/storage/:id` | Delete a file belonging to the current user. |

All routes require `Authorization: Bearer <accessToken>`. The web development proxy prefixes them with `/api`.

### Upload

Send JSON containing a filename, MIME type, original byte count, Base64 content without a data-URL prefix, and optional JSON metadata:

```json
{
  "fileName": "hello.txt",
  "mimeType": "text/plain",
  "fileSize": 5,
  "content": "SGVsbG8=",
  "meta": { "label": "Example" }
}
```

The application validates the encoded size and Base64 syntax, then calls `odbLob.base64ToBlob(content)`. It compares the decoded BLOB length with `fileSize` before calling `odbStorage.write`. A missing content value for a nonempty file or a byte-count mismatch is rejected rather than silently saving an empty file.

Empty files use `fileSize: 0` and `content: ""`; the application creates an empty temporary BLOB. Files are limited to `odbStorage.maxFileBytes`, currently 10,485,760 bytes (10 MiB).

The ORDS generator reads CLOB string inputs with `JSON_OBJECT_T.get_clob`, preserving values larger than 32,767 characters. Base64 adds approximately one third to the request size; reverse-proxy and ORDS request limits must allow for that overhead and the JSON envelope.

### Download

Downloads read the BLOB with `odbStorage.read`, then stream it with `odbHttp.download`:

```ts
import { defineService, odbHttp, odbPackage, odbStorage } from '@odbvue/odb'

const api = odbPackage('pck_files', (pkg) => {
  const download = pkg.proc(
    'download',
    { in: { ownerId: odbStorage.types.ownerId, id: odbStorage.types.id } },
    ({ params: { ownerId, id }, body }) => {
      const { fileName, mimeType, fileSize, content, meta } = body.variables({
        fileName: odbStorage.types.fileName,
        mimeType: odbStorage.types.mimeType,
        fileSize: odbStorage.types.fileSize,
        content: odbStorage.types.content,
        meta: odbStorage.types.meta,
      })
      body.call(odbStorage.read(ownerId, id, fileName, mimeType, fileSize, content, meta))
      body.call(odbHttp.download(content, fileName, mimeType))
    },
  )

  defineService(download, {
    auth: 'authenticated',
    method: 'GET',
    path: '/:id',
    responseMediaType: 'application/octet-stream',
    context: { userId: download.parameters.ownerId },
    uri: { id: download.parameters.id },
  })
  return {}
})
```

`responseMediaType` declares a binary response in OpenAPI; it does not emit the response itself. `odbHttp.download` emits the stored MIME type (or `application/octet-stream`), the actual BLOB length, attachment headers with a safe fallback filename and UTF-8 filename, `Cache-Control: private, no-store`, and `X-Content-Type-Options: nosniff`. It closes the HTTP headers and calls `WPG_DOCLOAD.DOWNLOAD_FILE`.

Use the shared HTTP client to download a Blob while retaining bearer-token attachment and refresh behavior:

```ts
const response = await http.get<Blob>(`/sandbox/storage/${encodeURIComponent(id)}`, {
  responseType: 'blob',
})
if (response.error || !response.data) throw new Error('Download failed')
```

The sandbox page checks the returned Blob size against the listed byte count, creates an object URL, and saves the file using the listed filename. It revokes the object URL after triggering the download. Download bytes are not converted to Base64.

## Errors

The capability raises transport-independent ODB errors. The sandbox's ORDS handler maps validation errors to HTTP 422 and `NOT_FOUND` to HTTP 404; unauthenticated requests receive HTTP 401.

| Code | Meaning |
| --- | --- |
| `STORAGE_OWNER_REQUIRED` | An owner ID is required for write and list. |
| `STORAGE_FILENAME_INVALID` | Filename is blank, exceeds 255 characters, or contains directory separators or control characters. |
| `STORAGE_MIME_TYPE_INVALID` | MIME type is malformed or exceeds 200 characters. |
| `STORAGE_META_INVALID` | Metadata is not valid JSON. |
| `STORAGE_CONTENT_REQUIRED` | A BLOB is required; the sandbox also rejects absent content for a nonempty upload. |
| `STORAGE_FILE_TOO_LARGE` | File or encoded upload exceeds the supported size. |
| `STORAGE_LIMIT_INVALID` | Explicit list limit is outside 1 through 101. |
| `STORAGE_FILE_NOT_FOUND` | File does not exist for the supplied owner. |
| `STORAGE_FILE_SIZE_REQUIRED` | Sandbox upload byte count is missing or negative. |
| `STORAGE_BASE64_INVALID` | Sandbox upload content is malformed or cannot be decoded. |
| `STORAGE_FILE_SIZE_MISMATCH` | Decoded upload byte count differs from the supplied byte count. |

## Limits And Scope

S3/object-storage exchange is not implemented. Files remain in Oracle; there are no S3 transfer, retrieval, or deletion operations.

This iteration also does not provide file replacement, versioning, previews, public/shareable download URLs, per-user quotas, resumable uploads, malware scanning, or content-based MIME detection. Applications must add their own policies where needed.

The working test page is `/sandbox/capabilities/storage`. It supports file selection, upload, paginated listing, binary download, and confirmed deletion. Its navigation follows the sandbox's developer-role page policy; the underlying storage endpoints require authentication and restrict files to their owner.

See [LOB helpers](./lob) for Base64 conversions and [Authentication](./auth) for identity and service authorization.
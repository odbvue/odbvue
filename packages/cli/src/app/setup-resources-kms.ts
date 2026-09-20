import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'

import { EnvironmentStore } from '../adapters/environment-store.js'
import { PodmanClient } from '../adapters/podman-client.js'
import { logger } from '../shared/logger.js'

export const KMS_SERVICE_NAME = 'odbvue-kms'

export const getLocalKekName = (projectName: string, currentEnv: string): string =>
  `${projectName}-${currentEnv}-kek`

const containerfile = `FROM node:22-alpine
WORKDIR /app
COPY server.js .
USER node
CMD ["node", "server.js"]
`

const server = `import { createDecipheriv } from 'node:crypto'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

const envelopeLength = 61
const kek = readFileSync('/run/secrets/' + process.env.ODBVUE_KMS_KEK_NAME)
if (kek.length !== 32) throw new Error('Invalid KEK length')

const send = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

const decodeEnvelope = (value) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null
  const envelope = Buffer.from(value, 'base64')
  return envelope.length === envelopeLength && value === envelope.toString('base64')
    ? envelope
    : null
}

createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') return send(response, 200, { status: 'ok' })
  if (request.method !== 'POST' || request.url !== '/v1/unwrap') return send(response, 404, { error: 'not found' })

  let body = ''
  let tooLarge = false
  request.setEncoding('utf8')
  request.on('data', (chunk) => {
    if (tooLarge) return
    body += chunk
    if (body.length > 1024) {
      tooLarge = true
      send(response, 413, { error: 'request too large' })
      request.resume()
    }
  })
  request.on('end', () => {
    if (tooLarge) return
    try {
      const envelope = decodeEnvelope(JSON.parse(body).value)
      if (!envelope || envelope[0] !== 1) return send(response, 400, { error: 'invalid request' })
      const decipher = createDecipheriv('aes-256-gcm', kek, envelope.subarray(1, 13))
      decipher.setAuthTag(envelope.subarray(13, 29))
      const value = Buffer.concat([decipher.update(envelope.subarray(29)), decipher.final()])
      if (value.length !== 32) return send(response, 400, { error: 'invalid request' })
      send(response, 200, { value: value.toString('base64') })
    } catch {
      send(response, 400, { error: 'invalid request' })
    }
  })
}).listen(8080, '0.0.0.0')
`

export const writeLocalKmsBuildContext = (envDir: string): void => {
  const kmsDir = path.join(envDir, 'kms')
  fs.mkdirSync(kmsDir, { recursive: true })
  fs.writeFileSync(path.join(kmsDir, 'Containerfile'), containerfile)
  fs.writeFileSync(path.join(kmsDir, 'server.js'), server)
}

export const getLocalKmsCompose = (kekName: string): Record<string, unknown> => ({
  build: { context: './kms' },
  container_name: KMS_SERVICE_NAME,
  environment: { ODBVUE_KMS_KEK_NAME: kekName },
  secrets: [kekName],
  networks: ['odbvue-internal'],
  healthcheck: {
    test: 'wget -q -O /dev/null http://127.0.0.1:8080/health',
    interval: '5s',
    timeout: '3s',
    retries: 12,
  },
})

export const ensureLocalKek = (podman: PodmanClient): void => {
  const { projectName, currentEnv } = new EnvironmentStore().getCurrent()
  const kekName = getLocalKekName(projectName, currentEnv)
  if (podman.secretExists(kekName)) {
    logger.muted(`OdbVue KMS KEK "${kekName}" will be reused.`)
    return
  }

  if (!podman.createSecret(kekName, randomBytes(32))) {
    throw new Error(`Failed to create Podman secret "${kekName}" for the OdbVue KMS KEK`)
  }
  logger.muted(`OdbVue KMS KEK "${kekName}" created.`)
}

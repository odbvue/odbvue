import { afterAll, beforeAll, describe, it } from 'vitest'
import { connect } from '../../../src/execution/oracle.js'
import { odbOracle } from '../../../src/oracle/index.js'

const connectString = process.env.ODB_TEST_CONNECT_STRING
const wallet = process.env.ODB_TEST_WALLET_DIR

describe.skipIf(!connectString)('UTC timestamps on Oracle', () => {
  let connection: Awaited<ReturnType<typeof connect>>

  beforeAll(async () => {
    connection = await connect({
      connectString,
      user: process.env.ODB_TEST_USER,
      password: process.env.ODB_TEST_PASSWORD,
      configDir: wallet,
      walletLocation: wallet,
      walletPassword: process.env.ODB_TEST_WALLET_PASSWORD,
    })
  }, 30_000)

  afterAll(async () => {
    await connection?.close()
  })

  it.each(['-08:00', '+05:30'])(
    'compares and serializes UTC instants across DST with session zone %s',
    async (zone) => {
      await connection.execute(`ALTER SESSION SET TIME_ZONE = '${zone}'`)
      await connection.execute(`DECLARE
  l_now TIMESTAMP := ${odbOracle.utcNow().toSQL()};
  l_from TIMESTAMP := TO_TIMESTAMP('2024-03-10T06:59:59.000Z', 'FXYYYY-MM-DD"T"HH24:MI:SS.FF3"Z"');
  l_to TIMESTAMP := TO_TIMESTAMP('2024-03-10T07:00:00.000Z', 'FXYYYY-MM-DD"T"HH24:MI:SS.FF3"Z"');
  l_count PLS_INTEGER;
BEGIN
  IF l_now > SYS_EXTRACT_UTC(SYSTIMESTAMP) OR
     l_now < SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '1' MINUTE THEN
    raise_application_error(-20000, 'Current UTC instant is incorrect');
  END IF;
  SELECT COUNT(*) INTO l_count FROM (
    SELECT SYS_EXTRACT_UTC(FROM_TZ(TIMESTAMP '2024-03-10 01:59:59', '-05:00')) AS created FROM dual
    UNION ALL
    SELECT SYS_EXTRACT_UTC(FROM_TZ(TIMESTAMP '2024-03-10 03:00:00', '-04:00')) FROM dual
    UNION ALL
    SELECT SYS_EXTRACT_UTC(FROM_TZ(TIMESTAMP '2024-03-10 03:00:01', '-04:00')) FROM dual
  ) WHERE created >= l_from AND created <= l_to
    AND TO_TIMESTAMP(TO_CHAR(created, 'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"'),
      'FXYYYY-MM-DD"T"HH24:MI:SS.FF6"Z"') = created;
  IF l_count != 2 THEN
    raise_application_error(-20000, 'UTC filtering or cursor round-trip failed');
  END IF;
END;`)
    },
  )
})

DECLARE

    c_name CONSTANT VARCHAR2(100) := 'pck_api_audit test';

    c_attributes CONSTANT CLOB := pck_api_audit.attributes(
        'action', 'TEST',
        'module', 'pck_api_audit'
    );

    PROCEDURE sub AS
    BEGIN

        pck_api_audit.start_span('New Sub Span');
        pck_api_audit.record_event('New Event for Sub Span');
        pck_api_audit.end_span;

    END;

BEGIN   

    pck_api_audit.begin_trace(
        p_name       => c_name,
        p_attributes => c_attributes
    );

    pck_api_audit.record_event(
        p_name     => 'Test Event 1',
        p_attributes => pck_api_audit.attributes(
            'step', '1',
            'info', 'This is the first test event'
        )
    );

    sub;

    pck_api_audit.record_event(
        p_name     => 'Test Event 1',
        p_attributes => pck_api_audit.attributes(
            'step', '2',
            'info', 'This is the second test event'
        )
    );

    pck_api_audit.info(
        p_message  => 'Audit Info',
        p_attributes => pck_api_audit.attributes(
            'event.type', 'startup',
            'uuid', LOWER(SYS_GUID())
          )
    );

    pck_api_audit.end_trace(
        p_status   => 'OK'
    );

EXCEPTION
    WHEN OTHERS THEN

        pck_api_audit.end_trace(
            p_status   => 'ERROR'
        );

        RAISE;
END;
/




/*

--

Trace (a single transaction/request)
 ├── Span A  (e.g. "HTTP Request")
 │    ├── Event: "Request queued"
 │    ├── Event: "Response received"
 │    └── Span B (child) "DB query"
 │         ├── Event: "SQL executed"
 │         └── Event: "DB returned 12 rows"
 ├── Span C  (child) "Write cache"
 └── Log: "End of trace, OK"

-

--

Database Schema:

app_audit_logs
app_audit_traces
app_audit_spans
app_audit_events

-- Log Example:
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          {"key":"service.name","value":{"stringValue":"orders-api"}},
          {"key":"service.version","value":{"stringValue":"2.3.1"}}
        ]
      },
      "scopeLogs": [
        {
          "scope": {"name":"plsql.audit","version":"0.2.0"},
          "logRecords": [
            {
              "timeUnixNano": "1731148800245000000",
              "observedTimeUnixNano": "1731148800245000000",
              "severityNumber": 9,
              "severityText": "INFO",
              "body": {"stringValue":"User APP_USER updated order 12345"},
              "attributes": [
                {"key":"action","value":{"stringValue":"UPDATE"}},
                {"key":"table","value":{"stringValue":"ORDERS"}},
                {"key":"order.id","value":{"stringValue":"12345"}}
              ],
              "traceId": "4e2b7bfe3a7e4b2b8e1c0b98e5619e0b",
              "spanId":  "e9132ffd0a1b2c3d",
              "flags": 1
            }
          ]
        }
      ]
    }
  ]
}

-- Span Example:
{
  "resourceSpans": [
    {
      "resource": {
        "attributes": [
          {"key":"service.name","value":{"stringValue":"orders-api"}},
          {"key":"service.version","value":{"stringValue":"2.3.1"}}
        ]
      },
      "scopeSpans": [
        {
          "scope": {"name":"plsql.audit","version":"0.2.0"},
          "spans": [
            {
              "traceId": "4e2b7bfe3a7e4b2b8e1c0b98e5619e0b",
              "spanId":  "e9132ffd0a1b2c3d",
              "parentSpanId": "ab12cd34ef56aa77",
              "name": "Process Order",
              "kind": "SPAN_KIND_INTERNAL",
              "startTimeUnixNano": "1731148800100000000",
              "endTimeUnixNano":   "1731148800340000000",
              "attributes": [
                {"key":"order.id","value":{"stringValue":"123"}}
              ],
              "events": [
                {
                  "timeUnixNano": "1731148800250000000",
                  "name": "SQL executed",
                  "attributes": [
                    {"key":"rows","value":{"intValue":"1"}},
                    {"key":"sql","value":{"stringValue":"INSERT INTO orders ..."}}
                  ]
                }
              ],
              "status": {"code":"STATUS_CODE_OK"}
            }
          ]
        }
      ]
    }
  ]
}

*/
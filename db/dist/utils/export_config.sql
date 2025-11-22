WITH settings AS (
    SELECT JSON_ARRAYAGG(
             JSON_OBJECT(
               'id'    VALUE id,
               'name'  VALUE name,
               'value' VALUE value,
               'secret' VALUE secret
               RETURNING CLOB
             )
             RETURNING CLOB
           ) AS settings
    FROM app_settings
),

aces AS (
    SELECT JSON_ARRAYAGG(
             JSON_OBJECT(
               'host'       VALUE host,
               'lower_port' VALUE lower_port,
               'upper_port' VALUE upper_port,
               'privilege'  VALUE privilege
               RETURNING CLOB
             )
             RETURNING CLOB
           ) AS aces
    FROM user_host_aces
),

grants AS (
    SELECT JSON_ARRAYAGG(
             privilege
             RETURNING CLOB
           ) AS grants
    FROM (
        SELECT privilege
        FROM user_sys_privs
        UNION ALL 
        SELECT privilege || ' ' || table_name
        FROM user_tab_privs
        WHERE privilege = 'EXECUTE'
    )
)

SELECT JSON_SERIALIZE(
         JSON_OBJECT(
           'grants'   VALUE g.grants   FORMAT JSON,
           'aces'     VALUE a.aces     FORMAT JSON,
           'settings' VALUE s.settings FORMAT JSON
           RETURNING CLOB
         )
         RETURNING CLOB PRETTY
       ) AS config_json
FROM settings s
CROSS JOIN aces a
CROSS JOIN grants g;

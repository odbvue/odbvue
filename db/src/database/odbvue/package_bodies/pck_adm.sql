CREATE OR REPLACE PACKAGE BODY odbvue.pck_adm AS

    PROCEDURE get_audit (
        p_search VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 10,
        p_offset PLS_INTEGER DEFAULT 0,
        r_audit  OUT SYS_REFCURSOR
    ) AS
    BEGIN
        OPEN r_audit FOR SELECT
                                              id                                        AS "id",
                                              severity                                  AS "severity",
                                              message                                   AS "message",
                                              attributes                                AS "{}attributes",
                                              to_char(created, 'YYYY-MM-DD HH24:MI:SS') AS "created"
                                          FROM
                                              app_audit
                         WHERE
                             p_search IS NULL
                             OR severity = upper(p_search)
                         ORDER BY
                             created DESC
                         OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_audit;

END pck_adm;
/


-- sqlcl_snapshot {"hash":"957e7ad0fb9026ec73294cd1524865e71d2d1eb4","type":"PACKAGE_BODY","name":"PCK_ADM","schemaName":"ODBVUE","sxml":""}
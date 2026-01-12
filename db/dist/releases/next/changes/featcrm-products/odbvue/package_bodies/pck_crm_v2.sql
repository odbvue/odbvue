-- liquibase formatted sql
-- changeset ODBVUE:1768224852246 stripComments:false  logicalFilePath:featcrm-products\odbvue\package_bodies\pck_crm_v2.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_crm_v2.sql:1e73b9bf4165d1546f65f0190e360e4cf64a4154:c4818cec17fcaf43dc014af587725ccb67e9e3f7:alter

CREATE OR REPLACE PACKAGE BODY odbvue.pck_crm_v2 AS

    PROCEDURE get_products (
        p_filter   IN VARCHAR2 DEFAULT NULL,
        p_sort     IN VARCHAR2 DEFAULT NULL,
        p_limit    IN PLS_INTEGER DEFAULT NULL,
        p_offset   IN PLS_INTEGER DEFAULT NULL,
        r_products OUT SYS_REFCURSOR
    ) IS
    BEGIN
        IF pck_api_auth.role(NULL, 'crm') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_products FOR SELECT
                                                  code        AS "id",
                                                  code        AS "code",
                                                  name        AS "name",
                                                  description AS "description",
                                                  price       AS "price",
                                                  status      AS "status",
                                                  created     AS "created"
                                              FROM
                                                  crm_products
                           ORDER BY
                               name ASC
                           OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_products;

    PROCEDURE post_product (
        p_code        IN VARCHAR2,
        p_name        IN VARCHAR2,
        p_description IN VARCHAR2,
        p_price       IN NUMBER
    ) IS
    BEGIN
        IF pck_api_auth.role(NULL, 'crm') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        UPDATE crm_products
        SET
            code = p_code,
            name = p_name,
            description = p_description,
            price = p_price,
            modified = systimestamp
        WHERE
            code = p_code;

        IF SQL%rowcount = 0 THEN
            INSERT INTO crm_products (
                code,
                name,
                description,
                price
            ) VALUES ( p_code,
                       p_name,
                       p_description,
                       p_price );

        END IF;

        COMMIT;
    END post_product;

    PROCEDURE get_persons (
        p_filter  IN VARCHAR2 DEFAULT NULL,
        p_sort    IN VARCHAR2 DEFAULT NULL,
        p_limit   IN PLS_INTEGER DEFAULT NULL,
        p_offset  IN PLS_INTEGER DEFAULT NULL,
        r_persons OUT SYS_REFCURSOR
    ) IS
    BEGIN
        IF pck_api_auth.role(NULL, 'crm') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_persons FOR SELECT
                                                guid                  AS "id",
                                                TRIM(first_name
                                                     || ' '
                                                     || last_name
                                                     || ' ' || legal_name) AS "fullname",
                                                type                  AS "type",
                                                phone                 AS "phone",
                                                email                 AS "email",
                                                created               AS "created"
                                            FROM
                                                crm_persons
                          ORDER BY
                              created DESC
                          OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_persons;

    PROCEDURE post_person (
        p_id         IN PLS_INTEGER,
        p_first_name IN VARCHAR2,
        p_last_name  IN VARCHAR2,
        p_phone      IN VARCHAR2,
        p_email      IN VARCHAR2
    ) IS
    BEGIN
        IF pck_api_auth.role(NULL, 'crm') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        UPDATE crm_persons
        SET
            type = 'I',
            first_name = p_first_name,
            last_name = p_last_name,
            phone = p_phone,
            email = p_email,
            modified = systimestamp
        WHERE
            id = p_id;

        IF SQL%rowcount = 0 THEN
            INSERT INTO crm_persons (
                type,
                first_name,
                last_name,
                phone,
                email
            ) VALUES ( 'I',
                       p_first_name,
                       p_last_name,
                       p_phone,
                       p_email );

        END IF;

        COMMIT;
    END post_person;

    PROCEDURE post_organization (
        p_id         IN PLS_INTEGER,
        p_legal_name IN VARCHAR2
    ) IS
    BEGIN
        IF pck_api_auth.role(NULL, 'crm') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        UPDATE crm_persons
        SET
            type = 'O',
            legal_name = p_legal_name,
            modified = systimestamp
        WHERE
            id = p_id;

        IF SQL%rowcount = 0 THEN
            INSERT INTO crm_persons (
                type,
                legal_name
            ) VALUES ( 'O',
                       p_legal_name );

        END IF;

        COMMIT;
    END post_organization;

END pck_crm_v2;
/


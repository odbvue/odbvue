CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_labels AS

    FUNCTION normalize_name (
        p_name IN VARCHAR2
    ) RETURN VARCHAR2 AS
    BEGIN
        RETURN upper(replace(p_name, ' ', '_'));
    END;

    FUNCTION get_label_id (
        p_label_name IN app_labels.name%TYPE
    ) RETURN app_labels.id%TYPE AS
        v_label_id   app_labels.id%TYPE;
        v_label_code app_labels.code%TYPE := normalize_name(p_label_name);
    BEGIN
        BEGIN
            INSERT INTO app_labels ( name ) VALUES ( p_label_name ) RETURNING id INTO v_label_id;

        EXCEPTION
            WHEN dup_val_on_index THEN
                SELECT
                    id
                INTO v_label_id
                FROM
                    app_labels
                WHERE
                    code = v_label_code;

        END;

        RETURN v_label_id;
    END;

    PROCEDURE link_label_nm (
        p_label_name   app_labels.name%TYPE,
        p_entity_name  app_label_links.entity_name%TYPE,
        p_entity_id_nm app_label_links.entity_id_nm%TYPE
    ) AS

        v_label_id    app_labels.id%TYPE := get_label_id(p_label_name);
        v_entity_name app_label_links.entity_name%TYPE := normalize_name(p_entity_name);
    BEGIN
        INSERT INTO app_label_links (
            label_id,
            entity_name,
            entity_id_nm
        ) VALUES ( v_label_id,
                   v_entity_name,
                   p_entity_id_nm );

    EXCEPTION
        WHEN dup_val_on_index THEN
            NULL;
    END;

    PROCEDURE unlink_label_nm (
        p_label_name   app_labels.name%TYPE,
        p_entity_name  app_label_links.entity_name%TYPE,
        p_entity_id_nm app_label_links.entity_id_nm%TYPE DEFAULT NULL
    ) AS

        v_label_id    app_labels.id%TYPE;
        v_label_code  app_labels.code%TYPE := normalize_name(p_label_name);
        v_entity_name app_label_links.entity_name%TYPE := normalize_name(p_entity_name);
    BEGIN
        SELECT
            id
        INTO v_label_id
        FROM
            app_labels
        WHERE
            code = v_label_code;

        DELETE FROM app_label_links
        WHERE
                label_id = v_label_id
            AND entity_name = v_entity_name
            AND ( p_entity_id_nm IS NULL
                  OR entity_id_nm = p_entity_id_nm );

    EXCEPTION
        WHEN no_data_found THEN
            NULL;
    END;

    PROCEDURE link_label_vc (
        p_label_name   app_labels.name%TYPE,
        p_entity_name  app_label_links.entity_name%TYPE,
        p_entity_id_vc app_label_links.entity_id_vc%TYPE
    ) AS

        v_label_id    app_labels.id%TYPE := get_label_id(p_label_name);
        v_entity_name app_label_links.entity_name%TYPE := normalize_name(p_entity_name);
    BEGIN
        INSERT INTO app_label_links (
            label_id,
            entity_name,
            entity_id_vc
        ) VALUES ( v_label_id,
                   v_entity_name,
                   p_entity_id_vc );

    EXCEPTION
        WHEN dup_val_on_index THEN
            NULL;
    END;

    PROCEDURE unlink_label_vc (
        p_label_name   app_labels.name%TYPE,
        p_entity_name  app_label_links.entity_name%TYPE,
        p_entity_id_vc app_label_links.entity_id_vc%TYPE DEFAULT NULL
    ) AS

        v_label_id    app_labels.id%TYPE;
        v_label_code  app_labels.code%TYPE := normalize_name(p_label_name);
        v_entity_name app_label_links.entity_name%TYPE := normalize_name(p_entity_name);
    BEGIN
        SELECT
            id
        INTO v_label_id
        FROM
            app_labels
        WHERE
            code = v_label_code;

        DELETE FROM app_label_links
        WHERE
                label_id = v_label_id
            AND entity_name = v_entity_name
            AND ( p_entity_id_vc IS NULL
                  OR entity_id_vc = p_entity_id_vc );

    EXCEPTION
        WHEN no_data_found THEN
            NULL;
    END;

    PROCEDURE purge_unused_labels (
        p_batch_size IN PLS_INTEGER DEFAULT 1000
    ) AS
        v_deleted       PLS_INTEGER := 0;
        v_deleted_total PLS_INTEGER := 0;
    BEGIN
        LOOP
            DELETE FROM app_labels l
            WHERE
                ROWID IN (
                    SELECT
                        rid
                    FROM
                        (
                            SELECT
                                l2.rowid rid
                            FROM
                                app_labels l2
                            WHERE
                                NOT EXISTS (
                                    SELECT
                                        1
                                    FROM
                                        app_label_links ll
                                    WHERE
                                        ll.label_id = l2.id
                                )
                            ORDER BY
                                l2.id
                        )
                    WHERE
                        ROWNUM <= nvl(p_batch_size, 2147483647)
                );

            v_deleted := SQL%rowcount;
            v_deleted_total := v_deleted_total + v_deleted;
            EXIT WHEN v_deleted = 0;
            dbms_output.put_line('Purged unused labels: ' || v_deleted_total);
        END LOOP;
    END;

END;
/


-- sqlcl_snapshot {"hash":"4faf3bb30594a5a2fd2ca78f02d17e608931dc9e","type":"PACKAGE_BODY","name":"PCK_API_LABELS","schemaName":"ODBVUE","sxml":""}
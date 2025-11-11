CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_labels AS

    FUNCTION normalize_name (
        p_name IN VARCHAR2
    ) RETURN VARCHAR2 AS
    BEGIN
        RETURN upper(replace(p_name, ' ', '_'));
    END;

    FUNCTION get_label_id (
        p_label_name IN labels.name%TYPE
    ) RETURN labels.id%TYPE AS
        v_label_id   labels.id%TYPE;
        v_label_code labels.code%TYPE := normalize_name(p_label_name);
    BEGIN
        BEGIN
            INSERT INTO labels ( name ) VALUES ( p_label_name ) RETURNING id INTO v_label_id;

        EXCEPTION
            WHEN dup_val_on_index THEN
                SELECT
                    id
                INTO v_label_id
                FROM
                    labels
                WHERE
                    code = v_label_code;

        END;

        RETURN v_label_id;
    END;

    PROCEDURE link_label_nm (
        p_label_name   labels.name%TYPE,
        p_entity_name  label_links.entity_name%TYPE,
        p_entity_id_nm label_links.entity_id_nm%TYPE
    ) AS

        v_label_id    labels.id%TYPE := get_label_id(p_label_name);
        v_entity_name label_links.entity_name%TYPE := normalize_name(p_entity_name);
    BEGIN
        INSERT INTO label_links (
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
        p_label_name   labels.name%TYPE,
        p_entity_name  label_links.entity_name%TYPE,
        p_entity_id_nm label_links.entity_id_nm%TYPE DEFAULT NULL
    ) AS

        v_label_id    labels.id%TYPE;
        v_label_code  labels.code%TYPE := normalize_name(p_label_name);
        v_entity_name label_links.entity_name%TYPE := normalize_name(p_entity_name);
    BEGIN
        SELECT
            id
        INTO v_label_id
        FROM
            labels
        WHERE
            code = v_label_code;

        DELETE FROM label_links
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
        p_label_name   labels.name%TYPE,
        p_entity_name  label_links.entity_name%TYPE,
        p_entity_id_vc label_links.entity_id_vc%TYPE
    ) AS

        v_label_id    labels.id%TYPE := get_label_id(p_label_name);
        v_entity_name label_links.entity_name%TYPE := normalize_name(p_entity_name);
    BEGIN
        INSERT INTO label_links (
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
        p_label_name   labels.name%TYPE,
        p_entity_name  label_links.entity_name%TYPE,
        p_entity_id_vc label_links.entity_id_vc%TYPE DEFAULT NULL
    ) AS

        v_label_id    labels.id%TYPE;
        v_label_code  labels.code%TYPE := normalize_name(p_label_name);
        v_entity_name label_links.entity_name%TYPE := normalize_name(p_entity_name);
    BEGIN
        SELECT
            id
        INTO v_label_id
        FROM
            labels
        WHERE
            code = v_label_code;

        DELETE FROM label_links
        WHERE
                label_id = v_label_id
            AND entity_name = v_entity_name
            AND ( p_entity_id_vc IS NULL
                  OR entity_id_vc = p_entity_id_vc );

    EXCEPTION
        WHEN no_data_found THEN
            NULL;
    END;

END;
/


-- sqlcl_snapshot {"hash":"ba2b34c66dc2207dc0cd58d49659dacd216ab4bf","type":"PACKAGE_BODY","name":"PCK_API_LABELS","schemaName":"ODBVUE","sxml":""}
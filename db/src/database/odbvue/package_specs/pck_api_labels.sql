CREATE OR REPLACE PACKAGE odbvue.pck_api_labels AS -- Package provides methods for managing labels

    PROCEDURE link_label_nm ( -- Procedure links a label to an entity
        p_label_name   labels.name%TYPE, -- Name of the label
        p_entity_name  label_links.entity_name%TYPE, -- Name of the entity
        p_entity_id_nm label_links.entity_id_nm%TYPE -- Numeric Id of the entity
    );

    PROCEDURE unlink_label_nm ( -- Procedure unlinks a label from an entity
        p_label_name   labels.name%TYPE, -- Name of the label
        p_entity_name  label_links.entity_name%TYPE, -- Name of the entity
        p_entity_id_nm label_links.entity_id_nm%TYPE DEFAULT NULL -- Numeric Id of the entity
    );

    PROCEDURE link_label_vc ( -- Procedure links a label to an entity
        p_label_name   labels.name%TYPE, -- Name of the label
        p_entity_name  label_links.entity_name%TYPE, -- Name of the entity
        p_entity_id_vc label_links.entity_id_vc%TYPE -- Variable character Id of the entity
    );

    PROCEDURE unlink_label_vc ( -- Procedure unlinks a label from an entity
        p_label_name   labels.name%TYPE, -- Name of the label
        p_entity_name  label_links.entity_name%TYPE, -- Name of the entity
        p_entity_id_vc label_links.entity_id_vc%TYPE DEFAULT NULL -- Variable character Id of the entity
    );

END;
/


-- sqlcl_snapshot {"hash":"abe9fcc4806bc7a49fedb3dd71d892b11676c401","type":"PACKAGE_SPEC","name":"PCK_API_LABELS","schemaName":"ODBVUE","sxml":""}
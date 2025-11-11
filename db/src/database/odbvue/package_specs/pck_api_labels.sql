CREATE OR REPLACE PACKAGE odbvue.pck_api_labels AS -- Package provides methods for managing labels

    PROCEDURE link_label_nm ( -- Procedure links a label to an entity
        p_label_name   app_labels.name%TYPE, -- Name of the label
        p_entity_name  app_label_links.entity_name%TYPE, -- Name of the entity
        p_entity_id_nm app_label_links.entity_id_nm%TYPE -- Numeric Id of the entity
    );

    PROCEDURE unlink_label_nm ( -- Procedure unlinks a label from an entity
        p_label_name   app_labels.name%TYPE, -- Name of the label
        p_entity_name  app_label_links.entity_name%TYPE, -- Name of the entity
        p_entity_id_nm app_label_links.entity_id_nm%TYPE DEFAULT NULL -- Numeric Id of the entity
    );

    PROCEDURE link_label_vc ( -- Procedure links a label to an entity
        p_label_name   app_labels.name%TYPE, -- Name of the label
        p_entity_name  app_label_links.entity_name%TYPE, -- Name of the entity
        p_entity_id_vc app_label_links.entity_id_vc%TYPE -- Variable character Id of the entity
    );

    PROCEDURE unlink_label_vc ( -- Procedure unlinks a label from an entity
        p_label_name   app_labels.name%TYPE, -- Name of the label
        p_entity_name  app_label_links.entity_name%TYPE, -- Name of the entity
        p_entity_id_vc app_label_links.entity_id_vc%TYPE DEFAULT NULL -- Variable character Id of the entity
    );

    PROCEDURE purge_unused_labels ( -- Procedure removes labels that are not linked to any entity
        p_batch_size IN PLS_INTEGER DEFAULT 1000 -- Number of labels to process in one batch
    );

END;
/


-- sqlcl_snapshot {"hash":"f3a560ff901a2e580b7e786a6e0ec116b9118661","type":"PACKAGE_SPEC","name":"PCK_API_LABELS","schemaName":"ODBVUE","sxml":""}
CREATE OR REPLACE PACKAGE odbvue.pck_api_app_labels AS -- Package provides methods for managing app_labels

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

END;
/


-- sqlcl_snapshot {"hash":"348d781a33011ec69961d39543a0a036d98eaa31","type":"PACKAGE_SPEC","name":"PCK_API_APP_LABELS","schemaName":"ODBVUE","sxml":""}
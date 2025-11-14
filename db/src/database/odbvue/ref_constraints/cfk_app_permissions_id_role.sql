ALTER TABLE odbvue.app_permissions
    ADD CONSTRAINT cfk_app_permissions_id_role
        FOREIGN KEY ( id_role )
            REFERENCES odbvue.app_roles ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"e66c295e224ce3257015f0edf25231e822864fc6","type":"REF_CONSTRAINT","name":"CFK_APP_PERMISSIONS_ID_ROLE","schemaName":"ODBVUE","sxml":""}
ALTER TABLE odbvue.app_permissions
    ADD CONSTRAINT cfk_app_permissions_id_user
        FOREIGN KEY ( id_user )
            REFERENCES odbvue.app_users ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"176fb8355a88c18266ae37c387d99844767d93bc","type":"REF_CONSTRAINT","name":"CFK_APP_PERMISSIONS_ID_USER","schemaName":"ODBVUE","sxml":""}
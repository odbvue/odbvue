ALTER TABLE odbvue.tra_acls
    ADD CONSTRAINT cfk_tra_acls_uuid
        FOREIGN KEY ( uuid )
            REFERENCES odbvue.app_users ( uuid )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"be680c124e43e22f2ddd4297453b6c182f13ba83","type":"REF_CONSTRAINT","name":"CFK_TRA_ACLS_UUID","schemaName":"ODBVUE","sxml":""}
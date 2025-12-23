ALTER TABLE odbvue.tra_acls
    ADD CONSTRAINT cfk_tra_acls_role
        FOREIGN KEY ( role )
            REFERENCES odbvue.app_roles ( role )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"77774094353a041ccc118a7a6938ddabd8d5e995","type":"REF_CONSTRAINT","name":"CFK_TRA_ACLS_ROLE","schemaName":"ODBVUE","sxml":""}
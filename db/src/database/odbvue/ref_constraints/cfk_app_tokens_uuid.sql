ALTER TABLE odbvue.app_tokens
    ADD CONSTRAINT cfk_app_tokens_uuid
        FOREIGN KEY ( uuid )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;


-- sqlcl_snapshot {"hash":"5ac6ee05c6ec133dab5895d514047670b21300f5","type":"REF_CONSTRAINT","name":"CFK_APP_TOKENS_UUID","schemaName":"ODBVUE","sxml":""}
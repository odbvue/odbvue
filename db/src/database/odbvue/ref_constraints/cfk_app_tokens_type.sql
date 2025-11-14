ALTER TABLE odbvue.app_tokens
    ADD CONSTRAINT cfk_app_tokens_type
        FOREIGN KEY ( type_id )
            REFERENCES odbvue.app_token_types ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"a410b8c0222fd5408c0ab3372e8e4efb0c2a969e","type":"REF_CONSTRAINT","name":"CFK_APP_TOKENS_TYPE","schemaName":"ODBVUE","sxml":""}
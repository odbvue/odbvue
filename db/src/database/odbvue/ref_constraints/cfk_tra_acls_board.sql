ALTER TABLE odbvue.tra_acls
    ADD CONSTRAINT cfk_tra_acls_board
        FOREIGN KEY ( board )
            REFERENCES odbvue.tra_boards ( key )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"f9b9133e94886a97a87a640e6d622a943b4b060f","type":"REF_CONSTRAINT","name":"CFK_TRA_ACLS_BOARD","schemaName":"ODBVUE","sxml":""}
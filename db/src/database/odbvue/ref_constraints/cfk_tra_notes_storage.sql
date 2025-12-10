ALTER TABLE odbvue.tra_notes
    ADD CONSTRAINT cfk_tra_notes_storage
        FOREIGN KEY ( storage_id )
            REFERENCES odbvue.app_storage ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"8e87d2e1868305cff84ba20c57976f1cfa4f7cca","type":"REF_CONSTRAINT","name":"CFK_TRA_NOTES_STORAGE","schemaName":"ODBVUE","sxml":""}
ALTER TABLE odbvue.tra_links
    ADD CONSTRAINT cfk_tra_links_parent
        FOREIGN KEY ( parent_id )
            REFERENCES odbvue.tra_tasks ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"363969dc172874cc654c3566aa4d3ab9d1337929","type":"REF_CONSTRAINT","name":"CFK_TRA_LINKS_PARENT","schemaName":"ODBVUE","sxml":""}
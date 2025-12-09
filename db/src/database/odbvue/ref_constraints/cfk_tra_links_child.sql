ALTER TABLE odbvue.tra_links
    ADD CONSTRAINT cfk_tra_links_child
        FOREIGN KEY ( child_id )
            REFERENCES odbvue.tra_tasks ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"73dbe4d44e67e8fa3038296bafc3db900dc94895","type":"REF_CONSTRAINT","name":"CFK_TRA_LINKS_CHILD","schemaName":"ODBVUE","sxml":""}
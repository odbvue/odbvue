ALTER TABLE odbvue.tra_ranks
    ADD CONSTRAINT cfk_tra_ranks_task
        FOREIGN KEY ( task_id )
            REFERENCES odbvue.tra_tasks ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"56a213daa539a9d9d9425128c0fec21704f91066","type":"REF_CONSTRAINT","name":"CFK_TRA_RANKS_TASK","schemaName":"ODBVUE","sxml":""}
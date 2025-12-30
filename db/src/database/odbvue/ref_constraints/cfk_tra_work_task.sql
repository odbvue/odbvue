ALTER TABLE odbvue.tra_work
    ADD CONSTRAINT cfk_tra_work_task
        FOREIGN KEY ( task_id )
            REFERENCES odbvue.tra_tasks ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"bb9a62fed2e6632879f331a4a5e512084998241c","type":"REF_CONSTRAINT","name":"CFK_TRA_WORK_TASK","schemaName":"ODBVUE","sxml":""}
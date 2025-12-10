ALTER TABLE odbvue.tra_notes
    ADD CONSTRAINT cfk_tra_notes_task
        FOREIGN KEY ( task_id )
            REFERENCES odbvue.tra_tasks ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"bb96d1d3910126f25ad1414992b3304b509caf45","type":"REF_CONSTRAINT","name":"CFK_TRA_NOTES_TASK","schemaName":"ODBVUE","sxml":""}
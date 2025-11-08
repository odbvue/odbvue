CREATE OR REPLACE EDITIONABLE TRIGGER odbvue.trg_ordsify
    AFTER CREATE OR ALTER ON SCHEMA BEGIN
        IF (
            ora_dict_obj_type = 'PACKAGE'
            AND ora_dict_obj_name IS NOT NULL
            AND ora_sysevent = 'CREATE'
        ) THEN
            dbms_scheduler.create_job(
                job_name   => 'JOB_ORDSIFY_' || ora_dict_obj_name,
                job_type   => 'PLSQL_BLOCK',
                job_action => 'BEGIN prc_ordsify('''
                              || ora_dict_obj_name
                              || ''', '''', FALSE); END;',
                start_date => systimestamp + INTERVAL '5' SECOND,
                enabled    => TRUE
            );

        END IF;
    END;
/

ALTER TRIGGER odbvue.trg_ordsify ENABLE;


-- sqlcl_snapshot {"hash":"f04620fb1a08aa29a8a1d6e122accfbca2a8b72d","type":"TRIGGER","name":"TRG_ORDSIFY","schemaName":"ODBVUE","sxml":""}
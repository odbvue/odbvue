-- liquibase formatted sql
-- changeset ODBVUE:1762284803923 stripComments:false  logicalFilePath:featdb\odbvue\triggers\trg_ordsify.sql
-- sqlcl_snapshot db/src/database/odbvue/triggers/trg_ordsify.sql:9c0376f30943f8379d009295be20bae0c49f2b6e:26cde499e2b2e130dfaf02bd017ebb2c18babea3:alter

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


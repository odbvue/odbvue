
  CREATE OR REPLACE EDITIONABLE TRIGGER "ODBVUE"."TRG_ORDSIFY" 
    after create or alter on schema begin
        if (
            ora_dict_obj_type = 'PACKAGE'
            and ora_dict_obj_name is not null
            and ora_sysevent = 'CREATE'
        ) then
            dbms_scheduler.create_job(
                job_name   => 'JOB_ORDSIFY_' || ora_dict_obj_name,
                job_type   => 'PLSQL_BLOCK',
                job_action => 'BEGIN prc_ordsify('''
                              || ora_dict_obj_name
                              || ''', '''', FALSE); END;',
                start_date => systimestamp + interval '5' second,
                enabled    => true
            );

        end if;
    end;
/
ALTER TRIGGER "ODBVUE"."TRG_ORDSIFY" ENABLE;


-- sqlcl_snapshot {"hash":"e83d9434c6f068f2bb0ba683e6422ac0a9b8dc86","type":"TRIGGER","name":"TRG_ORDSIFY","schemaName":"ODBVUE","sxml":""}
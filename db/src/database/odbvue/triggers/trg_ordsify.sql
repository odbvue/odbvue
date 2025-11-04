create or replace editionable trigger odbvue.trg_ordsify
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

alter trigger odbvue.trg_ordsify enable;


-- sqlcl_snapshot {"hash":"9c0376f30943f8379d009295be20bae0c49f2b6e","type":"TRIGGER","name":"TRG_ORDSIFY","schemaName":"ODBVUE","sxml":""}
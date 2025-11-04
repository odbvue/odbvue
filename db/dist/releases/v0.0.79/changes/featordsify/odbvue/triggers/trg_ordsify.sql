-- liquibase formatted sql
-- changeset ODBVUE:1762259633620 stripComments:false  logicalFilePath:featordsify\odbvue\triggers\trg_ordsify.sql
-- sqlcl_snapshot db/src/database/odbvue/triggers/trg_ordsify.sql:null:767348d00f419ecb13b64410d2ae8e81163ee8b3:create

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


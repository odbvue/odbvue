-- liquibase formatted sql
-- changeset ODBVUE:1763714037431 stripComments:false  logicalFilePath:featconsents\odbvue\ref_constraints\cfk_app_user_consents_user.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_user_consents_user.sql:null:f8c880e8f1fbdbbfc42d50f93399621982a97452:create

ALTER TABLE odbvue.app_user_consents
    ADD CONSTRAINT cfk_app_user_consents_user
        FOREIGN KEY ( user_id )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;


-- liquibase formatted sql
-- changeset ODBVUE:1767794234547 stripComments:false  logicalFilePath:featcrm\odbvue\ref_constraints\cfk_crm_surveys_author.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_crm_surveys_author.sql:null:2592c0c28e7cb94a1169cd3774ae7bfb0c02f1f5:create

ALTER TABLE odbvue.crm_surveys
    ADD CONSTRAINT cfk_crm_surveys_author
        FOREIGN KEY ( author )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;


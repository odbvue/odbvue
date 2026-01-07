-- liquibase formatted sql
-- changeset ODBVUE:1767794234608 stripComments:false  logicalFilePath:featcrm\odbvue\ref_constraints\cfk_crm_surveys_editor.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_crm_surveys_editor.sql:null:ce51734620d884472853ec3bd2958ea06078a9c3:create

ALTER TABLE odbvue.crm_surveys
    ADD CONSTRAINT cfk_crm_surveys_editor
        FOREIGN KEY ( editor )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;


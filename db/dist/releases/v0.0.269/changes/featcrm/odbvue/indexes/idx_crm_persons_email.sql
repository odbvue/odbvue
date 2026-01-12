-- liquibase formatted sql
-- changeset ODBVUE:1768206719472 stripComments:false  logicalFilePath:featcrm\odbvue\indexes\idx_crm_persons_email.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_persons_email.sql:null:ff441d60bfccfec47092c40ea9250c1a354599a7:create

CREATE INDEX odbvue.idx_crm_persons_email ON
    odbvue.crm_persons (
        email
    );


-- liquibase formatted sql
-- changeset ODBVUE:1763034962233 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_emails_addr_unique.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_emails_addr_unique.sql:null:b49f19bae3f08b383a98ce8c9895d1783598263e:create

CREATE UNIQUE INDEX odbvue.idx_app_emails_addr_unique ON
    odbvue.app_emails_addr (
        id_email,
        addr_type,
        addr_addr
    );


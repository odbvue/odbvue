-- liquibase formatted sql
-- changeset ODBVUE:hotfix_idx_crm_persons_email stripComments:false logicalFilePath:hotfix\odbvue\indexes\idx_crm_persons_email.sql

CREATE INDEX odbvue.idx_crm_persons_email ON
    odbvue.crm_persons (
        email
    );

-- liquibase formatted sql
-- changeset ODBVUE:hotfix_idx_crm_persons_phone stripComments:false logicalFilePath:hotfix\odbvue\indexes\idx_crm_persons_phone.sql

CREATE INDEX odbvue.idx_crm_persons_phone ON
    odbvue.crm_persons (
        phone
    );

-- liquibase formatted sql
-- changeset ODBVUE:add_tra_tasks_archived_column stripComments:false runOnChange:false
-- comment: Add archived column to tra_tasks table (missed by SQLcl project export)

ALTER TABLE odbvue.tra_tasks ADD archived TIMESTAMP(6);

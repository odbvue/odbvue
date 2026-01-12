-- liquibase formatted sql
-- changeset odbvue:hotfix_crm_persons_comments stripComments:false logicalFilePath:hotfix\odbvue\comments\crm_persons.sql

COMMENT ON TABLE odbvue.crm_persons IS
    'CRM Person Table';

COMMENT ON COLUMN odbvue.crm_persons.attributes IS
    'Attributes';

COMMENT ON COLUMN odbvue.crm_persons.created IS
    'Creation timestamp';

COMMENT ON COLUMN odbvue.crm_persons.email IS
    'Email address';

COMMENT ON COLUMN odbvue.crm_persons.first_name IS
    'First name';

COMMENT ON COLUMN odbvue.crm_persons.guid IS
    'Global Unique Identifier';

COMMENT ON COLUMN odbvue.crm_persons.id IS
    'Primary key';

COMMENT ON COLUMN odbvue.crm_persons.last_name IS
    'Last name';

COMMENT ON COLUMN odbvue.crm_persons.legal_name IS
    'Legal name';

COMMENT ON COLUMN odbvue.crm_persons.modified IS
    'Last modification timestamp';

COMMENT ON COLUMN odbvue.crm_persons.phone IS
    'Phone number';

COMMENT ON COLUMN odbvue.crm_persons.status IS
    'Status (A = Active, B = Blocked, C = Closed)';

COMMENT ON COLUMN odbvue.crm_persons.type IS
    'Person type (I = Individual, O = Organization)';

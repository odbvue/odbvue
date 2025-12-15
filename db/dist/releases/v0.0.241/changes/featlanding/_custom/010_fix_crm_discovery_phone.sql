-- liquibase formatted sql
-- changeset  SqlCl:1765806284711 stripComments:false logicalFilePath:featlanding\_custom\010_fix_crm_discovery_phone.sql
-- sqlcl_snapshot dist\releases\next\changes\featlanding\_custom\010_fix_crm_discovery_phone.sql:null:null:custom


ALTER TABLE odbvue.crm_discovery_requests DROP COLUMN phone;
ALTER TABLE odbvue.crm_discovery_requests ADD phone VARCHAR2(200 CHAR);

COMMENT ON COLUMN odbvue.crm_discovery_requests.phone IS 'Phone number provided by the lead.';

-- liquibase formatted sql
-- changeset ODBVUE:1762284803833 stripComments:false  logicalFilePath:featdb\odbvue\tables\dbtools$mcp_log.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/dbtools$mcp_log.sql:f33bbc149ebb996e68dd501effd1c62223066a2c:6a8f5ee8a913d0422b4b8af6669303d29a3605f6:alter

/*  Uncomment drop statement after ensuring it is performing the correct actions
alter table odbvue.dbtools$mcp_log
 drop primary key cascade;
*/

ALTER TABLE odbvue.dbtools$mcp_log ADD PRIMARY KEY ( id )
    USING INDEX ENABLE;


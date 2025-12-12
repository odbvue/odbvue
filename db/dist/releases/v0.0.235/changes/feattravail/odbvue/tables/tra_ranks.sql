-- liquibase formatted sql
-- changeset ODBVUE:1765536963394 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_ranks.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_ranks.sql:null:c8027065c336ff81512829d1f7a76934bcd70c38:create

CREATE TABLE odbvue.tra_ranks (
    task_id    NUMBER(19, 0),
    rank_value NUMBER(19, 0) NOT NULL ENABLE
);

ALTER TABLE odbvue.tra_ranks ADD PRIMARY KEY ( task_id )
    USING INDEX ENABLE;


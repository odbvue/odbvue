-- liquibase formatted sql
-- changeset ODBVUE:1765288871906 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_links.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_links.sql:ef47498c3863c6da6cf1d4529c7e5520181f1910:8956d979bc06ccbe1182ea4840ddeafa7f76ca83:alter

ALTER TABLE odbvue.tra_links
    ADD CONSTRAINT cpk_tra_links PRIMARY KEY ( parent_id,
                                               child_id )
        USING INDEX ENABLE;


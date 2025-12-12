-- liquibase formatted sql
-- changeset ODBVUE:1765536963242 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_ranks_rank_value.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_ranks_rank_value.sql:null:94a159565cebbef92f39400e247cffd3ca191324:create

CREATE INDEX odbvue.idx_tra_ranks_rank_value ON
    odbvue.tra_ranks (
        rank_value
    );


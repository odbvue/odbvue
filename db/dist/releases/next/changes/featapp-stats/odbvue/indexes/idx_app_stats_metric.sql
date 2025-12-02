-- liquibase formatted sql
-- changeset ODBVUE:1764677783241 stripComments:false  logicalFilePath:featapp-stats\odbvue\indexes\idx_app_stats_metric.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_stats_metric.sql:null:10a8fc84cf8c0465077f9244d457af91ed244a4f:create

CREATE INDEX odbvue.idx_app_stats_metric ON
    odbvue.app_stats (
        metric_name
    );


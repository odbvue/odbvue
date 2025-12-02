-- liquibase formatted sql
-- changeset ODBVUE:1764677783311 stripComments:false  logicalFilePath:featapp-stats\odbvue\indexes\idx_app_stats_metric_type.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_stats_metric_type.sql:null:9f1984d2a3e5c94bc205bb8fbc118ac8fc1cdb8e:create

CREATE INDEX odbvue.idx_app_stats_metric_type ON
    odbvue.app_stats (
        metric_name,
        period_type
    );


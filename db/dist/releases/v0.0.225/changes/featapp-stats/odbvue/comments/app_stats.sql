-- liquibase formatted sql
-- changeset odbvue:1764677783177 stripComments:false  logicalFilePath:featapp-stats\odbvue\comments\app_stats.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_stats.sql:null:d72255dbbac3a2aae1681c9ed6c70f08eb327625:create

COMMENT ON TABLE odbvue.app_stats IS
    'Application statistics aggregated over various time periods.';

COMMENT ON COLUMN odbvue.app_stats.metric_name IS
    'Name of the metric being recorded';

COMMENT ON COLUMN odbvue.app_stats.metric_value IS
    'Value of the metric for the given period';

COMMENT ON COLUMN odbvue.app_stats.period_end IS
    'End timestamp of the period';

COMMENT ON COLUMN odbvue.app_stats.period_label IS
    'Label for the period, e.g., 2024-06 for June 2024';

COMMENT ON COLUMN odbvue.app_stats.period_start IS
    'Start timestamp of the period';

COMMENT ON COLUMN odbvue.app_stats.period_type IS
    'Type of period: H=Hour, D=Day, W=Week, M=Month, Q=Quarter, Y=Year, A=All time';


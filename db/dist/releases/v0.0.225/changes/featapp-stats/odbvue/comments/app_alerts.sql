-- liquibase formatted sql
-- changeset odbvue:1764677783109 stripComments:false  logicalFilePath:featapp-stats\odbvue\comments\app_alerts.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_alerts.sql:null:282be34c69a61508d64307fb167bc37dded40b54:create

COMMENT ON TABLE odbvue.app_alerts IS
    'System alerts for admin dashboard';

COMMENT ON COLUMN odbvue.app_alerts.alert_text IS
    'The text description of the alert';

COMMENT ON COLUMN odbvue.app_alerts.alert_type IS
    'The type of alert: info, warning, error, success';

COMMENT ON COLUMN odbvue.app_alerts.alert_value IS
    'The value associated with the alert';

COMMENT ON COLUMN odbvue.app_alerts.created IS
    'Timestamp when the alert was created';


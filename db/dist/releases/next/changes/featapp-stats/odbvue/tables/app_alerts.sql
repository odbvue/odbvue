-- liquibase formatted sql
-- changeset ODBVUE:1764677783828 stripComments:false  logicalFilePath:featapp-stats\odbvue\tables\app_alerts.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_alerts.sql:null:7e4f84bb3c535caf827846e2a15169132973fb4b:create

CREATE TABLE odbvue.app_alerts (
    alert_text  VARCHAR2(200 CHAR),
    alert_value VARCHAR2(200 CHAR),
    alert_type  VARCHAR2(30 CHAR),
    created     TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE
);

ALTER TABLE odbvue.app_alerts
    ADD CONSTRAINT cpk_app_alerts PRIMARY KEY ( alert_text )
        USING INDEX ENABLE;


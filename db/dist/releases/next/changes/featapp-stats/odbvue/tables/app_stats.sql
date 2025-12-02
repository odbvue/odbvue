-- liquibase formatted sql
-- changeset ODBVUE:1764677783914 stripComments:false  logicalFilePath:featapp-stats\odbvue\tables\app_stats.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_stats.sql:null:9e44da4658b1a273accc90b34e8f93cf1c925464:create

CREATE TABLE odbvue.app_stats (
    period_type  CHAR(1 CHAR) NOT NULL ENABLE,
    period_label VARCHAR2(30 CHAR) NOT NULL ENABLE,
    period_start TIMESTAMP(6) NOT NULL ENABLE,
    period_end   TIMESTAMP(6) NOT NULL ENABLE,
    metric_name  VARCHAR2(200 CHAR) NOT NULL ENABLE,
    metric_value NUMBER NOT NULL ENABLE
);

ALTER TABLE odbvue.app_stats
    ADD CONSTRAINT chk_app_stats_period_type
        CHECK ( period_type IN ( 'H', 'D', 'W', 'M', 'Q',
                                 'Y', 'A' ) ) ENABLE;

ALTER TABLE odbvue.app_stats
    ADD CONSTRAINT cpk_app_stats
        PRIMARY KEY ( period_type,
                      period_label,
                      metric_name )
            USING INDEX ENABLE;


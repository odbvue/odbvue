-- liquibase formatted sql
-- changeset ODBVUE:1762857938247 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_label_links_label_id.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_label_links_label_id.sql:null:c02a083456f45797231371971a320b6adfffb57e:create

CREATE INDEX odbvue.idx_app_label_links_label_id ON
    odbvue.app_label_links (
        label_id
    )
        LOCAL ( PARTITION sys_p3447 NOCOMPRESS,
            PARTITION sys_p3448 NOCOMPRESS,
            PARTITION sys_p3449 NOCOMPRESS,
            PARTITION sys_p3450 NOCOMPRESS,
            PARTITION sys_p3451 NOCOMPRESS,
            PARTITION sys_p3452 NOCOMPRESS,
            PARTITION sys_p3453 NOCOMPRESS,
            PARTITION sys_p3454 NOCOMPRESS,
            PARTITION sys_p3455 NOCOMPRESS,
            PARTITION sys_p3456 NOCOMPRESS,
            PARTITION sys_p3457 NOCOMPRESS,
            PARTITION sys_p3458 NOCOMPRESS,
            PARTITION sys_p3459 NOCOMPRESS,
            PARTITION sys_p3460 NOCOMPRESS,
            PARTITION sys_p3461 NOCOMPRESS,
            PARTITION sys_p3462 NOCOMPRESS );


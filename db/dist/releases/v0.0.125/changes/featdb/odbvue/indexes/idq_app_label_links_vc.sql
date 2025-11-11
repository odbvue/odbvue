-- liquibase formatted sql
-- changeset ODBVUE:1762857938056 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idq_app_label_links_vc.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idq_app_label_links_vc.sql:null:dbcf2340000eb08eb129eaf8efa929a68fa77eef:create

CREATE UNIQUE INDEX odbvue.idq_app_label_links_vc ON
    odbvue.app_label_links (
        label_id,
        entity_name,
    nvl(entity_id_nm,(-1)),
        entity_id_vc
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


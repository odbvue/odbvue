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


-- sqlcl_snapshot {"hash":"dbcf2340000eb08eb129eaf8efa929a68fa77eef","type":"INDEX","name":"IDQ_APP_LABEL_LINKS_VC","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <UNIQUE></UNIQUE>\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDQ_APP_LABEL_LINKS_VC</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_LABEL_LINKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>LABEL_ID</NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ENTITY_NAME</NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <DEFAULT_EXPRESSION>NVL(\"ENTITY_ID_NM\",(-1))</DEFAULT_EXPRESSION>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ENTITY_ID_VC</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <LOCAL_PARTITIONING>\n         <PARTITION_LIST>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3447</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3448</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3449</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3450</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3451</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3452</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3453</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3454</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3455</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3456</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3457</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3458</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3459</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3460</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3461</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3462</NAME>\n            </PARTITION_LIST_ITEM>\n         </PARTITION_LIST>\n      </LOCAL_PARTITIONING>\n   </TABLE_INDEX>\n</INDEX>"}
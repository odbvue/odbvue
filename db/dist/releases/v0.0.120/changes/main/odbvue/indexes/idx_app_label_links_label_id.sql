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


-- sqlcl_snapshot {"hash":"c02a083456f45797231371971a320b6adfffb57e","type":"INDEX","name":"IDX_APP_LABEL_LINKS_LABEL_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_LABEL_LINKS_LABEL_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_LABEL_LINKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>LABEL_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <LOCAL_PARTITIONING>\n         <PARTITION_LIST>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3447</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3448</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3449</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3450</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3451</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3452</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3453</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3454</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3455</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3456</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3457</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3458</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3459</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3460</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3461</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3462</NAME>\n            </PARTITION_LIST_ITEM>\n         </PARTITION_LIST>\n      </LOCAL_PARTITIONING>\n   </TABLE_INDEX>\n</INDEX>"}
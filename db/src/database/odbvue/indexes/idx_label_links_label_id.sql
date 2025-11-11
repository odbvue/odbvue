CREATE INDEX odbvue.idx_label_links_label_id ON
    odbvue.label_links (
        label_id
    )
        LOCAL ( PARTITION sys_p3275 NOCOMPRESS,
            PARTITION sys_p3276 NOCOMPRESS,
            PARTITION sys_p3277 NOCOMPRESS,
            PARTITION sys_p3278 NOCOMPRESS,
            PARTITION sys_p3279 NOCOMPRESS,
            PARTITION sys_p3280 NOCOMPRESS,
            PARTITION sys_p3281 NOCOMPRESS,
            PARTITION sys_p3282 NOCOMPRESS,
            PARTITION sys_p3283 NOCOMPRESS,
            PARTITION sys_p3284 NOCOMPRESS,
            PARTITION sys_p3285 NOCOMPRESS,
            PARTITION sys_p3286 NOCOMPRESS,
            PARTITION sys_p3287 NOCOMPRESS,
            PARTITION sys_p3288 NOCOMPRESS,
            PARTITION sys_p3289 NOCOMPRESS,
            PARTITION sys_p3290 NOCOMPRESS );


-- sqlcl_snapshot {"hash":"9f736425ddb8f17de454def523bd37b23e38bbc3","type":"INDEX","name":"IDX_LABEL_LINKS_LABEL_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_LABEL_LINKS_LABEL_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>LABEL_LINKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>LABEL_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <LOCAL_PARTITIONING>\n         <PARTITION_LIST>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3275</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3276</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3277</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3278</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3279</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3280</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3281</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3282</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3283</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3284</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3285</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3286</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3287</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3288</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3289</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3290</NAME>\n            </PARTITION_LIST_ITEM>\n         </PARTITION_LIST>\n      </LOCAL_PARTITIONING>\n   </TABLE_INDEX>\n</INDEX>"}
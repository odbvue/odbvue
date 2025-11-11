CREATE UNIQUE INDEX odbvue.idq_label_links_vc ON
    odbvue.label_links (
        label_id,
        entity_name,
    nvl(entity_id_nm,(-1)),
        entity_id_vc
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


-- sqlcl_snapshot {"hash":"723c69760dc34adf66103e8102304b50cbace89a","type":"INDEX","name":"IDQ_LABEL_LINKS_VC","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <UNIQUE></UNIQUE>\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDQ_LABEL_LINKS_VC</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>LABEL_LINKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>LABEL_ID</NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ENTITY_NAME</NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <DEFAULT_EXPRESSION>NVL(\"ENTITY_ID_NM\",(-1))</DEFAULT_EXPRESSION>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ENTITY_ID_VC</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <LOCAL_PARTITIONING>\n         <PARTITION_LIST>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3275</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3276</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3277</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3278</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3279</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3280</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3281</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3282</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3283</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3284</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3285</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3286</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3287</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3288</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3289</NAME>\n            </PARTITION_LIST_ITEM>\n            <PARTITION_LIST_ITEM>\n               <NAME>SYS_P3290</NAME>\n            </PARTITION_LIST_ITEM>\n         </PARTITION_LIST>\n      </LOCAL_PARTITIONING>\n   </TABLE_INDEX>\n</INDEX>"}
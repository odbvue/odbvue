CREATE INDEX odbvue.idx_app_storage_s3_created ON
    odbvue.app_storage (
        s3_created
    );


-- sqlcl_snapshot {"hash":"dcf71132bb04878f7aca468e35324194bdfa956c","type":"INDEX","name":"IDX_APP_STORAGE_S3_CREATED","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_STORAGE_S3_CREATED</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_STORAGE</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>S3_CREATED</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
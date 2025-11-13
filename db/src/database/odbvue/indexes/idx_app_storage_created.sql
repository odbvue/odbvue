CREATE INDEX odbvue.idx_app_storage_created ON
    odbvue.app_storage (
        created
    );


-- sqlcl_snapshot {"hash":"3b7d7e7120ad141e3f355f508652851dd7e3b5d7","type":"INDEX","name":"IDX_APP_STORAGE_CREATED","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_STORAGE_CREATED</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_STORAGE</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CREATED</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
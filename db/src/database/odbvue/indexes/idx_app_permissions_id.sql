CREATE INDEX odbvue.idx_app_permissions_id ON
    odbvue.app_permissions (
        id
    );


-- sqlcl_snapshot {"hash":"c6956648bbc7e9000de65e45ed765045de52ac92","type":"INDEX","name":"IDX_APP_PERMISSIONS_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_PERMISSIONS_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_PERMISSIONS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
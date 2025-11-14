CREATE INDEX odbvue.idx_app_permissions_user ON
    odbvue.app_permissions (
        id_user
    );


-- sqlcl_snapshot {"hash":"d028ae7fe5893316183d72f7df9cb0fc2cbc0f67","type":"INDEX","name":"IDX_APP_PERMISSIONS_USER","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_PERMISSIONS_USER</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_PERMISSIONS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID_USER</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
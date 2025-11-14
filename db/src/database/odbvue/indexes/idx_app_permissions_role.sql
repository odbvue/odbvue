CREATE INDEX odbvue.idx_app_permissions_role ON
    odbvue.app_permissions (
        id_role
    );


-- sqlcl_snapshot {"hash":"27ff36dfd9d1dce52fae96cf1de947deea1d6f2f","type":"INDEX","name":"IDX_APP_PERMISSIONS_ROLE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_PERMISSIONS_ROLE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_PERMISSIONS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID_ROLE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
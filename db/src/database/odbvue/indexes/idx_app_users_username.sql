CREATE UNIQUE INDEX odbvue.idx_app_users_username ON
    odbvue.app_users (
        username
    );


-- sqlcl_snapshot {"hash":"2ece5355c3e17826faec2de75798c84be7b7a894","type":"INDEX","name":"IDX_APP_USERS_USERNAME","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <UNIQUE></UNIQUE>\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_USERS_USERNAME</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_USERS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>USERNAME</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
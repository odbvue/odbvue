CREATE UNIQUE INDEX odbvue.idq_app_labels_code ON
    odbvue.app_labels (
        code
    );


-- sqlcl_snapshot {"hash":"0d99a730c3810edaf13f1c54e120590b6051eea7","type":"INDEX","name":"IDQ_APP_LABELS_CODE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <UNIQUE></UNIQUE>\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDQ_APP_LABELS_CODE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_LABELS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CODE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
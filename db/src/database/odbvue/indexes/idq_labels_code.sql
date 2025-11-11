CREATE UNIQUE INDEX odbvue.idq_labels_code ON
    odbvue.labels (
        code
    );


-- sqlcl_snapshot {"hash":"b566f1852aafbf2fe2a8719c6b88fbe5d9619598","type":"INDEX","name":"IDQ_LABELS_CODE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <UNIQUE></UNIQUE>\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDQ_LABELS_CODE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>LABELS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CODE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
CREATE INDEX odbvue.idx_app_emails_attc_id_storage ON
    odbvue.app_emails_attc (
        id_storage
    );


-- sqlcl_snapshot {"hash":"275d4c5c149d1e7893a3b5543ca5afef0401df38","type":"INDEX","name":"IDX_APP_EMAILS_ATTC_ID_STORAGE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_EMAILS_ATTC_ID_STORAGE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_EMAILS_ATTC</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID_STORAGE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
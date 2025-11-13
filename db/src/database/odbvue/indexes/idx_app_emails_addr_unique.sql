CREATE UNIQUE INDEX odbvue.idx_app_emails_addr_unique ON
    odbvue.app_emails_addr (
        id_email,
        addr_type,
        addr_addr
    );


-- sqlcl_snapshot {"hash":"b49f19bae3f08b383a98ce8c9895d1783598263e","type":"INDEX","name":"IDX_APP_EMAILS_ADDR_UNIQUE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <UNIQUE></UNIQUE>\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_EMAILS_ADDR_UNIQUE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_EMAILS_ADDR</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID_EMAIL</NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ADDR_TYPE</NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ADDR_ADDR</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
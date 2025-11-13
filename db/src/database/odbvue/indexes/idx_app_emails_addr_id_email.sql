CREATE INDEX odbvue.idx_app_emails_addr_id_email ON
    odbvue.app_emails_addr (
        id_email
    );


-- sqlcl_snapshot {"hash":"6e6b67151cebf6ee22e232db13bf3b9ea6830eb5","type":"INDEX","name":"IDX_APP_EMAILS_ADDR_ID_EMAIL","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_EMAILS_ADDR_ID_EMAIL</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_EMAILS_ADDR</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID_EMAIL</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
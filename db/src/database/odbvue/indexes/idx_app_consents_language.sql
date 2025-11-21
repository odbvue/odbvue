CREATE INDEX odbvue.idx_app_consents_language ON
    odbvue.app_consents (
        language_id
    );


-- sqlcl_snapshot {"hash":"f6faa8d6874b836a6458ac193181042ceab8ef17","type":"INDEX","name":"IDX_APP_CONSENTS_LANGUAGE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_CONSENTS_LANGUAGE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_CONSENTS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>LANGUAGE_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
CREATE INDEX odbvue.idx_app_consents_active ON
    odbvue.app_consents (
        active
    );


-- sqlcl_snapshot {"hash":"2ec301cdb190759c6eac97dbe74a86956b8c5e38","type":"INDEX","name":"IDX_APP_CONSENTS_ACTIVE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_CONSENTS_ACTIVE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_CONSENTS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ACTIVE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
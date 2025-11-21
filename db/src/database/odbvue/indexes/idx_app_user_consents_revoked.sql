CREATE INDEX odbvue.idx_app_user_consents_revoked ON
    odbvue.app_user_consents (
        revoked
    );


-- sqlcl_snapshot {"hash":"1a995612143a22efcebb4812e9c295d31210e140","type":"INDEX","name":"IDX_APP_USER_CONSENTS_REVOKED","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_USER_CONSENTS_REVOKED</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_USER_CONSENTS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>REVOKED</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
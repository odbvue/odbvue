CREATE INDEX odbvue.idx_app_user_consents_consent ON
    odbvue.app_user_consents (
        consent_id
    );


-- sqlcl_snapshot {"hash":"12319c7634e010cc26510e3d1af215f7732098d7","type":"INDEX","name":"IDX_APP_USER_CONSENTS_CONSENT","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_USER_CONSENTS_CONSENT</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_USER_CONSENTS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CONSENT_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
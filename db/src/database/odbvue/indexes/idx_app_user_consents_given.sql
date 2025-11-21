CREATE INDEX odbvue.idx_app_user_consents_given ON
    odbvue.app_user_consents (
        given
    );


-- sqlcl_snapshot {"hash":"414bd49fb3cc9151ee1a7e56399c41dbd8fbf919","type":"INDEX","name":"IDX_APP_USER_CONSENTS_GIVEN","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_USER_CONSENTS_GIVEN</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_USER_CONSENTS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>GIVEN</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
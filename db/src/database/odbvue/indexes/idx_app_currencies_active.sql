CREATE INDEX odbvue.idx_app_currencies_active ON
    odbvue.app_currencies (
        active
    );


-- sqlcl_snapshot {"hash":"433659ea717e51a927c33a0f56ce854017234e17","type":"INDEX","name":"IDX_APP_CURRENCIES_ACTIVE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_CURRENCIES_ACTIVE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_CURRENCIES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ACTIVE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
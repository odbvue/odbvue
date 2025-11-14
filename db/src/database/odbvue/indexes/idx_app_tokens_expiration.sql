CREATE INDEX odbvue.idx_app_tokens_expiration ON
    odbvue.app_tokens (
        expiration
    );


-- sqlcl_snapshot {"hash":"ee0c8811f095cd1428fda010d3b12acd1a8ca744","type":"INDEX","name":"IDX_APP_TOKENS_EXPIRATION","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_TOKENS_EXPIRATION</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_TOKENS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>EXPIRATION</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
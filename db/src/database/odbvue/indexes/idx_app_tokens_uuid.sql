CREATE INDEX odbvue.idx_app_tokens_uuid ON
    odbvue.app_tokens (
        uuid
    );


-- sqlcl_snapshot {"hash":"7c6261156feb37ab31028d55ff71ab6c2f06da61","type":"INDEX","name":"IDX_APP_TOKENS_UUID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_TOKENS_UUID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_TOKENS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>UUID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
CREATE INDEX odbvue.idx_app_countries_name ON
    odbvue.app_countries (
        name
    );


-- sqlcl_snapshot {"hash":"6d5e2392d15eabf143a07f5bf2dbff9850417081","type":"INDEX","name":"IDX_APP_COUNTRIES_NAME","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_COUNTRIES_NAME</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_COUNTRIES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>NAME</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
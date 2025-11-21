CREATE INDEX odbvue.idx_app_languages_name ON
    odbvue.app_languages (
        name
    );


-- sqlcl_snapshot {"hash":"2e9e3b69865318b2534fe670ca0719189028ebde","type":"INDEX","name":"IDX_APP_LANGUAGES_NAME","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_LANGUAGES_NAME</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_LANGUAGES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>NAME</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
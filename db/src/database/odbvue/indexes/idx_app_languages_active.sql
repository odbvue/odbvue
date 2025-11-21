CREATE INDEX odbvue.idx_app_languages_active ON
    odbvue.app_languages (
        active
    );


-- sqlcl_snapshot {"hash":"90c62caa0ce8fecad9053d29a7dab77e71fff712","type":"INDEX","name":"IDX_APP_LANGUAGES_ACTIVE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_LANGUAGES_ACTIVE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_LANGUAGES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ACTIVE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
CREATE INDEX odbvue.idx_app_countries_active ON
    odbvue.app_countries (
        active
    );


-- sqlcl_snapshot {"hash":"c01ced9a437c81278b902f8692b092cda8a313b9","type":"INDEX","name":"IDX_APP_COUNTRIES_ACTIVE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_COUNTRIES_ACTIVE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_COUNTRIES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ACTIVE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
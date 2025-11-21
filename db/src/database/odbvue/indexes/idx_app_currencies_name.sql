CREATE INDEX odbvue.idx_app_currencies_name ON
    odbvue.app_currencies (
        name
    );


-- sqlcl_snapshot {"hash":"8ad252986d77cc73453202761f9eb4617e10a304","type":"INDEX","name":"IDX_APP_CURRENCIES_NAME","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_CURRENCIES_NAME</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_CURRENCIES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>NAME</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
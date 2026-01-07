CREATE INDEX odbvue.idx_crm_surveys_created ON
    odbvue.crm_surveys (
        created
    );


-- sqlcl_snapshot {"hash":"781d017f4351e9b7ca38ff51924310a73902a359","type":"INDEX","name":"IDX_CRM_SURVEYS_CREATED","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_SURVEYS_CREATED</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_SURVEYS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CREATED</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
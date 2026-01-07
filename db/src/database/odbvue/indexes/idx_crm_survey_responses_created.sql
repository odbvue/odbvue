CREATE INDEX odbvue.idx_crm_survey_responses_created ON
    odbvue.crm_survey_responses (
        created
    );


-- sqlcl_snapshot {"hash":"64498aa1066456b12ab639eb1d6c3991e98f04f2","type":"INDEX","name":"IDX_CRM_SURVEY_RESPONSES_CREATED","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_SURVEY_RESPONSES_CREATED</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_SURVEY_RESPONSES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CREATED</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
CREATE INDEX odbvue.idx_crm_survey_responses_survey ON
    odbvue.crm_survey_responses (
        survey_id
    );


-- sqlcl_snapshot {"hash":"b6206a6e84cc19c9c8163a1611a0fddcf5f04bf4","type":"INDEX","name":"IDX_CRM_SURVEY_RESPONSES_SURVEY","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_SURVEY_RESPONSES_SURVEY</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_SURVEY_RESPONSES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>SURVEY_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
CREATE INDEX odbvue.idx_crm_survey_responses_author ON
    odbvue.crm_survey_responses (
        author
    );


-- sqlcl_snapshot {"hash":"b87882f5f3dbf5fd8a811fb19ed9560bcd13ba6f","type":"INDEX","name":"IDX_CRM_SURVEY_RESPONSES_AUTHOR","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_SURVEY_RESPONSES_AUTHOR</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_SURVEY_RESPONSES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>AUTHOR</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
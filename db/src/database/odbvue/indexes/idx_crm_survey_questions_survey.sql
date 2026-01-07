CREATE INDEX odbvue.idx_crm_survey_questions_survey ON
    odbvue.crm_survey_questions (
        survey_id
    );


-- sqlcl_snapshot {"hash":"17dd26c821e2aac7104b816bccfaaec5f31a6cf5","type":"INDEX","name":"IDX_CRM_SURVEY_QUESTIONS_SURVEY","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_SURVEY_QUESTIONS_SURVEY</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_SURVEY_QUESTIONS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>SURVEY_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
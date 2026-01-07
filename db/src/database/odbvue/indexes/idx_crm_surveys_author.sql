CREATE INDEX odbvue.idx_crm_surveys_author ON
    odbvue.crm_surveys (
        author
    );


-- sqlcl_snapshot {"hash":"751f08e299f36f1b06a65816efa6f7d7d9c891b4","type":"INDEX","name":"IDX_CRM_SURVEYS_AUTHOR","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_SURVEYS_AUTHOR</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_SURVEYS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>AUTHOR</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
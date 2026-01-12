CREATE INDEX odbvue.idx_crm_persons_phone ON
    odbvue.crm_persons (
        phone
    );


-- sqlcl_snapshot {"hash":"56d072c8e7dc8c8532aeec6fcdc17324c820bf78","type":"INDEX","name":"IDX_CRM_PERSONS_PHONE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_PERSONS_PHONE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_PERSONS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>PHONE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
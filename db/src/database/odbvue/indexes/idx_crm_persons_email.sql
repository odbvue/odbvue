CREATE INDEX odbvue.idx_crm_persons_email ON
    odbvue.crm_persons (
        email
    );


-- sqlcl_snapshot {"hash":"ff441d60bfccfec47092c40ea9250c1a354599a7","type":"INDEX","name":"IDX_CRM_PERSONS_EMAIL","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_PERSONS_EMAIL</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_PERSONS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>EMAIL</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
CREATE INDEX odbvue.idx_crm_persons_first_name_last_name ON
    odbvue.crm_persons (
        first_name,
        last_name
    );


-- sqlcl_snapshot {"hash":"abb340701078d1281e731d06a3954fc82df0ee76","type":"INDEX","name":"IDX_CRM_PERSONS_FIRST_NAME_LAST_NAME","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_PERSONS_FIRST_NAME_LAST_NAME</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_PERSONS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>FIRST_NAME</NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>LAST_NAME</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
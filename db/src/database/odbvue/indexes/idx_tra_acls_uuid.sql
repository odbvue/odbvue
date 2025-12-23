CREATE INDEX odbvue.idx_tra_acls_uuid ON
    odbvue.tra_acls (
        uuid
    );


-- sqlcl_snapshot {"hash":"5035f852e86f9c176222e8f11fd8fb255fb8f7a8","type":"INDEX","name":"IDX_TRA_ACLS_UUID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_ACLS_UUID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_ACLS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>UUID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
CREATE INDEX odbvue.idx_crm_discovery_requests_created ON
    odbvue.crm_discovery_requests (
        created
    );


-- sqlcl_snapshot {"hash":"40c6bda210627b76d6b834b4d2e3d3adfbe23e65","type":"INDEX","name":"IDX_CRM_DISCOVERY_REQUESTS_CREATED","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_CRM_DISCOVERY_REQUESTS_CREATED</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>CRM_DISCOVERY_REQUESTS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CREATED</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
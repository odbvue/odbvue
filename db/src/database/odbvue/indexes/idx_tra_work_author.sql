CREATE INDEX odbvue.idx_tra_work_author ON
    odbvue.tra_work (
        author
    );


-- sqlcl_snapshot {"hash":"d4b8ddfa47ce355a2f9d2898e357b6f4a344981a","type":"INDEX","name":"IDX_TRA_WORK_AUTHOR","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_WORK_AUTHOR</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_WORK</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>AUTHOR</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
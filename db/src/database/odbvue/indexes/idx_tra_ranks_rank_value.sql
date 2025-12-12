CREATE INDEX odbvue.idx_tra_ranks_rank_value ON
    odbvue.tra_ranks (
        rank_value
    );


-- sqlcl_snapshot {"hash":"94a159565cebbef92f39400e247cffd3ca191324","type":"INDEX","name":"IDX_TRA_RANKS_RANK_VALUE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_RANKS_RANK_VALUE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_RANKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>RANK_VALUE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
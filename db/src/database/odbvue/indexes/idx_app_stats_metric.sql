CREATE INDEX odbvue.idx_app_stats_metric ON
    odbvue.app_stats (
        metric_name
    );


-- sqlcl_snapshot {"hash":"10a8fc84cf8c0465077f9244d457af91ed244a4f","type":"INDEX","name":"IDX_APP_STATS_METRIC","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_STATS_METRIC</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_STATS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>METRIC_NAME</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
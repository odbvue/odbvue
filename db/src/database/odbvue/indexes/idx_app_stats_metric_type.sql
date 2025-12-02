CREATE INDEX odbvue.idx_app_stats_metric_type ON
    odbvue.app_stats (
        metric_name,
        period_type
    );


-- sqlcl_snapshot {"hash":"9f1984d2a3e5c94bc205bb8fbc118ac8fc1cdb8e","type":"INDEX","name":"IDX_APP_STATS_METRIC_TYPE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_STATS_METRIC_TYPE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_STATS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>METRIC_NAME</NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>PERIOD_TYPE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}
-- liquibase formatted sql
-- changeset ODBVUE:1766496653741 stripComments:false  logicalFilePath:feattravail\odbvue\ref_constraints\cfk_tra_acls_board.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_tra_acls_board.sql:null:f9b9133e94886a97a87a640e6d622a943b4b060f:create

ALTER TABLE odbvue.tra_acls
    ADD CONSTRAINT cfk_tra_acls_board
        FOREIGN KEY ( board )
            REFERENCES odbvue.tra_boards ( key )
                ON DELETE CASCADE
        ENABLE;


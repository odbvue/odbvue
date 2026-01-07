ALTER TABLE odbvue.crm_surveys
    ADD CONSTRAINT cfk_crm_surveys_editor
        FOREIGN KEY ( editor )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;


-- sqlcl_snapshot {"hash":"ce51734620d884472853ec3bd2958ea06078a9c3","type":"REF_CONSTRAINT","name":"CFK_CRM_SURVEYS_EDITOR","schemaName":"ODBVUE","sxml":""}
CREATE OR REPLACE PACKAGE odbvue.pck_api_storage -- Package for storing and processing large binary objects
 AS
    PROCEDURE upload ( -- Procedure stores binary file
        p_file      app_storage.content%TYPE, -- File content
        p_file_name app_storage.file_name%TYPE, -- File name
        r_id        OUT app_storage.id%TYPE, -- File ID
        p_s3        BOOLEAN DEFAULT FALSE -- Upload to S3 flag
    );

    PROCEDURE upload ( -- Procedure stores binary file
        p_file      app_storage.content%TYPE, -- File content
        p_file_name app_storage.file_name%TYPE, -- File name
        p_s3        BOOLEAN DEFAULT FALSE -- Upload to S3 flag
    );

    PROCEDURE download ( -- Procedure retrieves binary file
        p_id        app_storage.id%TYPE, -- File ID
        r_file      OUT NOCOPY app_storage.content%TYPE, -- File content
        r_file_name OUT app_storage.file_name%TYPE, -- File name
        r_file_size OUT app_storage.file_size%TYPE, -- File size
        r_file_ext  OUT app_storage.file_ext%TYPE, -- File ext
        r_mime_type OUT app_storage.mime_type%TYPE -- Mime type
    );

    PROCEDURE download ( -- Procedure retrieves binary file
        p_id        app_storage.id%TYPE, -- File ID
        r_file      OUT NOCOPY app_storage.content%TYPE, -- File content
        r_file_name OUT app_storage.file_name%TYPE -- File name
    );

    PROCEDURE DELETE ( -- Procedure deletes binary file
        p_id app_storage.id%TYPE -- File ID
    );

    PROCEDURE s3 ( -- Procedure migrates file to S3 storage
        p_operation    CHAR, -- Operation (U - upload from local to S3, D - download from S3 to local)
        p_id           app_storage.id%TYPE DEFAULT NULL, -- File ID
        p_created_from TIMESTAMP DEFAULT NULL, -- Created from
        p_created_to   TIMESTAMP DEFAULT NULL, -- Created to
        p_batch_size   NUMBER DEFAULT 100 -- Batch size
    );

END;
/


-- sqlcl_snapshot {"hash":"08ea336315aa0136745bebb3120095bb8226c250","type":"PACKAGE_SPEC","name":"PCK_API_STORAGE","schemaName":"ODBVUE","sxml":""}
-- liquibase formatted sql
-- changeset ODBVUE:1763018047348 stripComments:false  logicalFilePath:featdb\odbvue\package_bodies\pck_api_storage.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_storage.sql:null:4341cd9779a8d39068f31a81310dc10991410831:create

CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_storage AS

    FUNCTION force_trailing_slash (
        p_uri IN VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        RETURN
            CASE
                WHEN p_uri IS NULL THEN
                    '/'
                WHEN substr(
                    trim(p_uri),
                    -1
                ) = '/' THEN
                    TRIM(p_uri)
                ELSE
                    TRIM(p_uri)
                    || '/'
            END;
    END;

    FUNCTION to_s3 (
        p_id      app_storage.id%TYPE,
        p_content app_storage.content%TYPE
    ) RETURN app_storage.s3_uri%TYPE AS
        v_s3_uri app_storage.s3_uri%TYPE;
    BEGIN
        BEGIN
            v_s3_uri := pck_api_settings.read('APP_STORAGE_S3_URI');
            v_s3_uri := force_trailing_slash(v_s3_uri)
                        || p_id;
        EXCEPTION
            WHEN no_data_found THEN
                raise_application_error(-20001, 'S3 URI setting APP_STORAGE_S3_URI not found');
        END;

        dbms_cloud.put_object('OCI$RESOURCE_PRINCIPAL', v_s3_uri, p_content);
        RETURN v_s3_uri;
    END;

    PROCEDURE from_s3 (
        p_s3_uri  app_storage.s3_uri%TYPE,
        r_content IN OUT NOCOPY app_storage.content%TYPE
    ) AS
    BEGIN
        IF p_s3_uri IS NULL THEN
            RETURN;
        END IF;
        r_content := dbms_cloud.get_object(
            credential_name => 'OCI$RESOURCE_PRINCIPAL',
            object_uri      => p_s3_uri
        );
    END;

    PROCEDURE rm_s3 (
        p_s3_uri app_storage.s3_uri%TYPE
    ) AS
    BEGIN
        IF p_s3_uri IS NULL THEN
            RETURN;
        END IF;
        dbms_cloud.delete_object(
            credential_name => 'OCI$RESOURCE_PRINCIPAL',
            object_uri      => p_s3_uri
        );
    END;

    PROCEDURE upload (
        p_file      app_storage.content%TYPE,
        p_file_name app_storage.file_name%TYPE,
        r_id        OUT app_storage.id%TYPE,
        p_s3        BOOLEAN DEFAULT FALSE
    ) AS

        v_file_ext  app_storage.file_ext%TYPE := substr(p_file_name,
                                                       nullif(instr(p_file_name, '.', -1) + 1,
                                                              1));
        v_mime_type app_storage.mime_type%TYPE := pck_api_http.mime_type(v_file_ext);
        v_id        app_storage.id%TYPE := lower(sys_guid());
        v_s3_uri    app_storage.s3_uri%TYPE;
    BEGIN
        IF p_s3 THEN
            v_s3_uri := to_s3(v_id, p_file);
        END IF;
        INSERT INTO app_storage (
            id,
            file_name,
            file_size,
            file_ext,
            mime_type,
            content,
            s3_uri,
            s3_created
        ) VALUES ( v_id,
                   p_file_name,
                   dbms_lob.getlength(p_file),
                   v_file_ext,
                   v_mime_type,
                   CASE
                       WHEN v_s3_uri IS NOT NULL THEN
                           empty_blob()
                       ELSE
                           p_file
                   END,
                   CASE
                       WHEN v_s3_uri IS NOT NULL THEN
                           v_s3_uri
                       ELSE
                           NULL
                   END,
                   CASE
                       WHEN v_s3_uri IS NOT NULL THEN
                           systimestamp
                       ELSE
                           NULL
                   END
        );

        r_id := v_id;
    END;

    PROCEDURE upload (
        p_file      app_storage.content%TYPE,
        p_file_name app_storage.file_name%TYPE,
        p_s3        BOOLEAN DEFAULT FALSE
    ) AS
        v_id app_storage.id%TYPE;
    BEGIN
        upload(p_file, p_file_name, v_id, p_s3);
    END;

    PROCEDURE download (
        p_id        app_storage.id%TYPE,
        r_file      OUT NOCOPY app_storage.content%TYPE,
        r_file_name OUT app_storage.file_name%TYPE,
        r_file_size OUT app_storage.file_size%TYPE,
        r_file_ext  OUT app_storage.file_ext%TYPE,
        r_mime_type OUT app_storage.mime_type%TYPE
    ) AS
        v_s3_uri app_storage.s3_uri%TYPE;
    BEGIN
        SELECT
            content,
            file_name,
            file_size,
            file_ext,
            mime_type,
            s3_uri
        INTO
            r_file,
            r_file_name,
            r_file_size,
            r_file_ext,
            r_mime_type,
            v_s3_uri
        FROM
            app_storage
        WHERE
            id = p_id;

        IF v_s3_uri IS NOT NULL THEN
            from_s3(v_s3_uri, r_file);
        END IF;
    END;

    PROCEDURE download (
        p_id        app_storage.id%TYPE,
        r_file      OUT NOCOPY app_storage.content%TYPE,
        r_file_name OUT app_storage.file_name%TYPE
    ) AS

        v_s3_uri    app_storage.s3_uri%TYPE;
        v_file_size app_storage.file_size%TYPE;
        v_file_ext  app_storage.file_ext%TYPE;
        v_mime_type app_storage.mime_type%TYPE;
    BEGIN
        download(p_id, r_file, r_file_name, v_file_size, v_file_ext,
                 v_mime_type);
    END;

    PROCEDURE DELETE (
        p_id app_storage.id%TYPE
    ) AS
        v_s3_uri app_storage.s3_uri%TYPE;
    BEGIN
        SELECT
            s3_uri
        INTO v_s3_uri
        FROM
            app_storage
        WHERE
            id = p_id;

        IF v_s3_uri IS NOT NULL THEN
            rm_s3(v_s3_uri);
        END IF;
        DELETE FROM app_storage
        WHERE
            id = p_id;

    END;

    PROCEDURE s3 (
        p_operation    CHAR,
        p_id           app_storage.id%TYPE DEFAULT NULL,
        p_created_from TIMESTAMP DEFAULT NULL,
        p_created_to   TIMESTAMP DEFAULT NULL,
        p_batch_size   NUMBER DEFAULT 100
    ) AS

        PRAGMA autonomous_transaction;
        v_file     app_storage.content%TYPE;
        v_s3_uri   app_storage.s3_uri%TYPE;
        v_count_up PLS_INTEGER := 0;
        v_count_dn PLS_INTEGER := 0;
    BEGIN
        IF p_operation = 'U' THEN
            FOR r IN (
                SELECT
                    id,
                    content
                FROM
                    app_storage
                WHERE
                    ( p_id IS NULL
                      OR id = p_id )
                    AND ( p_created_from IS NULL
                          OR created >= p_created_from )
                    AND ( p_created_to IS NULL
                          OR created <= p_created_to )
                    AND s3_uri IS NULL
                FETCH NEXT p_batch_size ROWS ONLY
            ) LOOP
                v_s3_uri := to_s3(r.id, r.content);
                UPDATE app_storage
                SET
                    s3_uri = v_s3_uri,
                    s3_created = systimestamp,
                    content = empty_blob()
                WHERE
                    id = r.id;

                v_count_up := v_count_up + 1;
            END LOOP;

            COMMIT;
        END IF;

        IF p_operation = 'D' THEN
            FOR r IN (
                SELECT
                    id,
                    s3_uri
                FROM
                    app_storage
                WHERE
                    ( p_id IS NULL
                      OR id = p_id )
                    AND ( p_created_from IS NULL
                          OR s3_created >= p_created_from )
                    AND ( p_created_to IS NULL
                          OR s3_created <= p_created_to )
                    AND s3_uri IS NOT NULL
                FETCH NEXT p_batch_size ROWS ONLY
            ) LOOP
                v_file := NULL;
                from_s3(r.s3_uri, v_file);
                UPDATE app_storage
                SET
                    content = v_file,
                    s3_uri = NULL,
                    s3_created = NULL
                WHERE
                    id = r.id;

                v_count_dn := v_count_dn + 1;
            END LOOP;

            COMMIT;
        END IF;

        dbms_output.put_line('S3 migration completed. '
                             || 'Uploaded: '
                             || v_count_up
                             || ' files. '
                             || 'Downloaded: '
                             || v_count_dn || ' files.');

    END;

END;
/


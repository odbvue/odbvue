COMMENT ON TABLE odbvue.app_storage IS
    'Table for storing files in securefile LOBs';

COMMENT ON COLUMN odbvue.app_storage.content IS
    'Binary content of the file';

COMMENT ON COLUMN odbvue.app_storage.created IS
    'Timestamp when the file was created';

COMMENT ON COLUMN odbvue.app_storage.file_ext IS
    'File extension';

COMMENT ON COLUMN odbvue.app_storage.file_name IS
    'Original name of the file';

COMMENT ON COLUMN odbvue.app_storage.file_size IS
    'Size of the file in bytes';

COMMENT ON COLUMN odbvue.app_storage.id IS
    'Unique identifier for the stored file';

COMMENT ON COLUMN odbvue.app_storage.mime_type IS
    'MIME type of the file';

COMMENT ON COLUMN odbvue.app_storage.s3_created IS
    'Timestamp when the file was uploaded to S3';

COMMENT ON COLUMN odbvue.app_storage.s3_uri IS
    'URI of the file in S3 storage';


-- sqlcl_snapshot {"hash":"7445f8d1749566c5ae2a95a2e9b5b7a888bd2f85","type":"COMMENT","name":"app_storage","schemaName":"odbvue","sxml":""}
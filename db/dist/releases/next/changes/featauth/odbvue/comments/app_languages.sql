-- liquibase formatted sql
-- changeset odbvue:1763708910813 stripComments:false  logicalFilePath:featauth\odbvue\comments\app_languages.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_languages.sql:null:183c711ee61eaddf41d143a499a7883a170a8fa9:create

COMMENT ON TABLE odbvue.app_languages IS
    'Table of languages';

COMMENT ON COLUMN odbvue.app_languages.active IS
    'Indicates if the language is active';

COMMENT ON COLUMN odbvue.app_languages.created IS
    'Record creation timestamp';

COMMENT ON COLUMN odbvue.app_languages.id IS
    'ISO 639-1 language code (2 letters)';

COMMENT ON COLUMN odbvue.app_languages.iso3 IS
    'ISO 639-2 language code (3 letters)';

COMMENT ON COLUMN odbvue.app_languages.name IS
    'Language name in English';

COMMENT ON COLUMN odbvue.app_languages.native IS
    'Language name in native language';


COMMENT ON TABLE odbvue.app_countries IS
    'Table of countries';

COMMENT ON COLUMN odbvue.app_countries.active IS
    'Indicates if the country is active';

COMMENT ON COLUMN odbvue.app_countries.created IS
    'Record creation timestamp';

COMMENT ON COLUMN odbvue.app_countries.id IS
    'ISO 3166-1 alpha-2 country code';

COMMENT ON COLUMN odbvue.app_countries.iso3 IS
    'ISO 3166-1 alpha-3 country code';

COMMENT ON COLUMN odbvue.app_countries.name IS
    'Country name in English';

COMMENT ON COLUMN odbvue.app_countries.native IS
    'Country name in native language';


-- sqlcl_snapshot {"hash":"381275b86564cb7cb31e5069625404b956721651","type":"COMMENT","name":"app_countries","schemaName":"odbvue","sxml":""}
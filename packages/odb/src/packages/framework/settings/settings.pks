CREATE OR REPLACE PACKAGE odb_settings AS -- Key/value settings store with transparent AES-256 encryption for secrets.

    PROCEDURE write ( -- Upserts a setting; when p_secret = 'Y' the value is stored encrypted
        p_id      IN VARCHAR2, -- Setting id (primary key)
        p_name    IN VARCHAR2, -- Human-readable name
        p_value   IN VARCHAR2, -- Value (encrypted at rest when p_secret = 'Y')
        p_options IN CLOB DEFAULT NULL, -- Optional JSON metadata
        p_secret  IN VARCHAR2 DEFAULT 'N' -- 'Y' to encrypt the value, 'N' to store as plain text
    );

    PROCEDURE read ( -- Reads a setting, decrypting it when it is a secret
        p_id    IN VARCHAR2, -- Setting id
        r_value OUT VARCHAR2 -- Decrypted value
    );

    FUNCTION read ( -- Reads a setting, decrypting it when it is a secret
        p_id IN VARCHAR2 -- Setting id
    ) RETURN VARCHAR2; -- Decrypted value

    PROCEDURE remove ( -- Deletes a setting
        p_id IN VARCHAR2 -- Setting id
    );

END odb_settings;
/

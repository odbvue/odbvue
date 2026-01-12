CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_zip AS

    TYPE file_list IS
        TABLE OF CLOB;
    TYPE file_names IS
        TABLE OF VARCHAR2(4000);
  --
    TYPE file_info IS RECORD (
            found        BOOLEAN,
            is_directory BOOLEAN,
            is_encrypted BOOLEAN,
            idx          INTEGER,
            len          INTEGER,
            clen         INTEGER,
            name         CLOB,
            comment      CLOB,
            nname        NVARCHAR2(32767)
    );
  --

  --
    c_version                  CONSTANT RAW(1) := hextoraw('16'); -- version 2.2
  --
    TYPE tp_zip_info IS RECORD (
            len            INTEGER,
            cnt            INTEGER,
            len_cd         INTEGER,
            idx_cd         INTEGER,
            idx_eocd       INTEGER,
            idx_zip64_eocd INTEGER,
            zip64          BOOLEAN,
            len_comment    PLS_INTEGER,
            comment1       RAW(32767),
            comment2       RAW(32767),
            comment3       RAW(100)
    );
    TYPE tp_cfh IS RECORD (
            offset             INTEGER,
            compressed_len     INTEGER,
            original_len       INTEGER,
            len                PLS_INTEGER,
            n                  PLS_INTEGER,
            m                  PLS_INTEGER,
            k                  PLS_INTEGER,
            utf8               BOOLEAN,
            encrypted          BOOLEAN,
            crc32              RAW(4),
            external_file_attr RAW(4),
            encoding           VARCHAR2(3999),
            idx                INTEGER,
            name1              RAW(32767),
            name2              RAW(32767),
            name3              RAW(100),
            zip64              BOOLEAN,
            zip64_offset       PLS_INTEGER,
            comment1           RAW(32767),
            comment2           RAW(32767),
            comment3           RAW(100)
    );
  --
    c_lob_duration             CONSTANT PLS_INTEGER := dbms_lob.call;
    c_local_file_header        CONSTANT RAW(4) := hextoraw('504B0304'); -- Local file header signature
    c_central_file_header      CONSTANT RAW(4) := hextoraw('504B0102'); -- Central directory file header signature
    c_end_of_central_directory CONSTANT RAW(4) := hextoraw('504B0506'); -- End of central directory signature
    c_zip64_end_of_cd          CONSTANT RAW(4) := hextoraw('504B0606'); -- Zip64 end of central directory
    c_zip64_end_of_cd_locator  CONSTANT RAW(4) := hextoraw('504B0607'); -- Zip64 end of central directory locator
    c_data_descriptor          CONSTANT RAW(4) := hextoraw('504B0708'); -- Data Descriptor
  --
    TYPE tp_zipcrypto_tab IS
        TABLE OF RAW(4) INDEX BY VARCHAR2(2);
    l_zipcrypto_tab            tp_zipcrypto_tab;
    l_key1                     RAW(4);
    l_key2                     RAW(4);
    l_key3                     RAW(4);

  --
    FUNCTION inflate (
        p_cmpr                 BLOB,
        p_deflate64            BOOLEAN := TRUE,
        p_max_uncompressed_len INTEGER
    ) RETURN BLOB IS

        l_rv                  BLOB;
        l_buf                 VARCHAR2(32767);
        l_idx                 INTEGER := 1;
        l_buf_idx             INTEGER := 32767;
        l_bit_idx             NUMBER := 256;
        l_current             NUMBER;
        l_final               BOOLEAN;
        l_type                NUMBER;
        l_len                 NUMBER;
        l_len_stored          NUMBER;
        TYPE tp_huffman_tree IS
            TABLE OF PLS_INTEGER INDEX BY VARCHAR2(16); -- max 16 bit codelength
        l_fixed_literal_tree  tp_huffman_tree;
        l_fixed_distance_tree tp_huffman_tree;
        TYPE tp_sliding_window IS
            TABLE OF RAW(1) INDEX BY PLS_INTEGER;
        l_sliding_window      tp_sliding_window;
        l_slw_idx             PLS_INTEGER := 0;
        l_slw_sz              PLS_INTEGER := 65535;  -- actual size minus 1
    --
        FUNCTION get_1bit RETURN NUMBER IS
            t NUMBER;
        BEGIN
            IF l_bit_idx > 128 THEN
                l_bit_idx := 1;
                IF l_buf_idx > 32766 THEN
                    l_buf := dbms_lob.substr(p_cmpr, 16383, l_idx);
                    l_idx := l_idx + length(l_buf) / 2;
                    l_buf_idx := 1;
                END IF;

                l_current := TO_NUMBER ( substr(l_buf, l_buf_idx, 2), 'xx' );
                l_buf_idx := l_buf_idx + 2;
            END IF;

            t := sign(bitand(l_current, l_bit_idx));
            l_bit_idx := l_bit_idx * 2;
            RETURN t;
        END;
    --
        FUNCTION bit_string (
            p_code PLS_INTEGER,
            p_bits PLS_INTEGER
        ) RETURN VARCHAR2 IS
            l_rv VARCHAR2(16);
        BEGIN
            FOR b IN 0..p_bits - 1 LOOP
                l_rv :=
                    CASE bitand(p_code,
                                power(2, b))
                        WHEN 0 THEN
                            '0'
                        ELSE
                            '1'
                    END
                    || l_rv;
            END LOOP;

            RETURN l_rv;
        END;
    --
        FUNCTION get_extra (
            p_bits PLS_INTEGER
        ) RETURN NUMBER IS
            l_rv NUMBER := 0;
        BEGIN
            FOR i IN 0..p_bits - 1 LOOP
                IF get_1bit > 0 THEN
                    l_rv := l_rv + power(2, i);
                END IF;
            END LOOP;

            RETURN l_rv;
        END;
    --
        PROCEDURE slw2rv (
            p_max PLS_INTEGER
        ) IS
            l_tmp VARCHAR2(32767);
        BEGIN
            IF p_max < 0 THEN
                RETURN;
            END IF;
            FOR j IN 0..4 LOOP
                l_tmp := NULL;
                FOR i IN j * 16383..least(j * 16383 + 16382, p_max) LOOP
                    l_tmp := l_tmp || l_sliding_window(i);
                END LOOP;

                IF l_tmp IS NOT NULL THEN
                    dbms_lob.writeappend(l_rv,
                                         length(l_tmp) / 2,
                                         l_tmp);
                END IF;

            END LOOP;

        END;
    --
        PROCEDURE add2_sliding_window (
            p_uncpr RAW
        ) IS
        BEGIN
            FOR i IN 1..utl_raw.length(p_uncpr) LOOP
                l_sliding_window(l_slw_idx) := utl_raw.substr(p_uncpr, i, 1);
                IF l_slw_idx >= l_slw_sz THEN
                    slw2rv(l_slw_idx);
                    l_slw_idx := 0;
                ELSE
                    l_slw_idx := l_slw_idx + 1;
                END IF;

            END LOOP;
        END;
    --
        PROCEDURE from_slw_to_slw (
            p_len      PLS_INTEGER,
            p_distance PLS_INTEGER
        ) IS
            l_slw_i PLS_INTEGER;
        BEGIN
            l_slw_i := l_slw_idx - p_distance;
            IF l_slw_i < 0 THEN
                l_slw_i := l_slw_i + l_slw_sz + 1;
            END IF;
            FOR i IN 1..p_len LOOP
                add2_sliding_window(l_sliding_window(l_slw_i));
                IF l_slw_i >= l_slw_sz THEN
                    l_slw_i := 0;
                ELSE
                    l_slw_i := l_slw_i + 1;
                END IF;

            END LOOP;

        END;
    --
        PROCEDURE inflate_huffman (
            p_literal_tree  tp_huffman_tree,
            p_distance_tree tp_huffman_tree
        ) IS
            l_code       VARCHAR2(16);
            l_symbol     NUMBER;
            l_distance   NUMBER;
            l_extra_bits NUMBER;
        BEGIN
            LOOP
                l_code :=
                    CASE get_1bit
                        WHEN 0 THEN
                            '0'
                        ELSE
                            '1'
                    END;
                WHILE NOT p_literal_tree.EXISTS(l_code) LOOP
                    l_code := l_code
                              ||
                        CASE get_1bit
                            WHEN 0 THEN
                                '0'
                            ELSE
                                '1'
                        END;
                END LOOP;

                l_symbol := p_literal_tree(l_code);
                IF l_symbol < 256 THEN
                    add2_sliding_window(to_char(l_symbol, 'fm0X'));
                ELSIF l_symbol = 256 THEN
                    EXIT;
                ELSE
                    IF l_symbol < 265 THEN
                        l_len := l_symbol - 254;
                    ELSIF l_symbol = 285 THEN
                        l_len :=
                            CASE
                                WHEN p_deflate64 THEN
                                    3 + get_extra(16)
                                ELSE
                                    258
                            END;
                    ELSE
                        l_extra_bits := trunc((l_symbol - 261) / 4);
                        l_len :=
                            CASE
                                WHEN l_symbol BETWEEN 265 AND 268 THEN
                                    11
                                WHEN l_symbol BETWEEN 269 AND 272 THEN
                                    19
                                WHEN l_symbol BETWEEN 273 AND 276 THEN
                                    35
                                WHEN l_symbol BETWEEN 277 AND 280 THEN
                                    67
                                WHEN l_symbol BETWEEN 281 AND 284 THEN
                                    131
                            END
                            + MOD(l_symbol - 1, 4) * power(2, l_extra_bits);

                        l_len := l_len + get_extra(l_extra_bits);
                    END IF;

                    l_code :=
                        CASE get_1bit
                            WHEN 0 THEN
                                '0'
                            ELSE
                                '1'
                        END;
                    WHILE NOT p_distance_tree.EXISTS(l_code) LOOP
                        l_code := l_code
                                  ||
                            CASE get_1bit
                                WHEN 0 THEN
                                    '0'
                                ELSE
                                    '1'
                            END;
                    END LOOP;

                    l_distance := p_distance_tree(l_code);
                    IF l_distance > 3 THEN
                        l_extra_bits := trunc(l_distance / 2) - 1;
                        IF bitand(l_distance, 1) = 0 THEN
                            l_distance := power(2, l_extra_bits + 1);
                        ELSE
                            l_distance := power(2, l_extra_bits) + power(2, l_extra_bits + 1);
                        END IF;

                        l_distance := l_distance + get_extra(l_extra_bits);
                    END IF;

                    l_distance := l_distance + 1;
                    from_slw_to_slw(l_len, l_distance);
                END IF;

            END LOOP;
        END;
    --
        PROCEDURE handle_dynamic_huffman_block IS

            l_hlit           NUMBER;
            l_hdist          NUMBER;
            l_hclen          NUMBER;
            l_tmp            NUMBER;
            l_tree           tp_huffman_tree;
            l_literal_tree   tp_huffman_tree;
            l_distance_tree  tp_huffman_tree;
            TYPE tp_num_tab IS
                TABLE OF PLS_INTEGER INDEX BY PLS_INTEGER;
            l_bit_counts     tp_num_tab;
            l_tmp_bit_counts tp_num_tab;
            TYPE tp_remap_tab IS
                TABLE OF PLS_INTEGER;
            l_remap_tab      tp_remap_tab := tp_remap_tab(16, 17, 18, 0, 8,
                                                     7, 9, 6, 10, 5,
                                                     11, 4, 12, 3, 13,
                                                     2, 14, 1, 15);
            l_extra          NUMBER;
            l_i              PLS_INTEGER;
      --
            PROCEDURE build_huffman_tree (
                p_bit_counts tp_num_tab,
                p_tree       OUT tp_huffman_tree,
                p_max        PLS_INTEGER
            ) IS
                l_code NUMBER := 0;
            BEGIN
                FOR b IN 1..p_max LOOP
                    FOR i IN p_bit_counts.first..p_bit_counts.last LOOP
                        IF p_bit_counts(i) = b THEN
                            p_tree(bit_string(l_code, b)) := i;
                            l_code := l_code + 1;
                        END IF;
                    END LOOP;

                    l_code := l_code * 2;
                END LOOP;
            END;
      --
            PROCEDURE load_huffman_tree (
                p_cnt  PLS_INTEGER,
                p_tree OUT tp_huffman_tree
            ) IS

                l_i          PLS_INTEGER;
                l_symbol     PLS_INTEGER;
                l_code       VARCHAR2(16);
                l_bit_counts tp_num_tab;
                l_max        PLS_INTEGER := 0;
            BEGIN
                l_i := 0;
                WHILE l_i < p_cnt LOOP
                    l_code :=
                        CASE get_1bit
                            WHEN 0 THEN
                                '0'
                            ELSE
                                '1'
                        END;
                    WHILE NOT l_tree.EXISTS(l_code) LOOP
                        l_code := l_code
                                  ||
                            CASE get_1bit
                                WHEN 0 THEN
                                    '0'
                                ELSE
                                    '1'
                            END;
                    END LOOP;

                    l_symbol := l_tree(l_code);
                    IF l_symbol = 16 THEN
                        FOR i IN 1..3 + get_extra(2) LOOP
                            l_bit_counts(l_i) := l_bit_counts(l_i - 1);
                            l_i := l_i + 1;
                        END LOOP;
                    ELSIF l_symbol = 17 THEN
                        FOR i IN 1..3 + get_extra(3) LOOP
                            l_bit_counts(l_i) := 0;
                            l_i := l_i + 1;
                        END LOOP;
                    ELSIF l_symbol = 18 THEN
                        FOR i IN 1..11 + get_extra(7) LOOP
                            l_bit_counts(l_i) := 0;
                            l_i := l_i + 1;
                        END LOOP;
                    ELSE
                        l_bit_counts(l_i) := l_symbol;
                        l_i := l_i + 1;
                        l_max := greatest(l_max, l_symbol);
                    END IF;

                END LOOP;

                build_huffman_tree(l_bit_counts, p_tree, l_max);
            END;

        BEGIN
            l_hlit := get_extra(5);
            l_hdist := get_extra(5);
            l_hclen := get_extra(4);
            FOR i IN 1..l_hclen + 4 LOOP
                l_tmp_bit_counts(i) := get_extra(3);
            END LOOP;

            FOR i IN l_hclen + 5..19 LOOP
                l_tmp_bit_counts(i) := 0;
            END LOOP;

            FOR i IN 1..19 LOOP
                l_bit_counts(l_remap_tab(i)) := l_tmp_bit_counts(i);
            END LOOP;

            build_huffman_tree(l_bit_counts, l_tree, 7);
            load_huffman_tree(l_hlit + 257, l_literal_tree);
            load_huffman_tree(l_hdist + 1, l_distance_tree);
            inflate_huffman(l_literal_tree, l_distance_tree);
        END;
    --
        PROCEDURE add_codes_to_tree (
            huffman_tree IN OUT NOCOPY tp_huffman_tree,
            bit_cnt      PLS_INTEGER,
            cnt          PLS_INTEGER,
            start_symbol PLS_INTEGER,
            start_code   PLS_INTEGER
        ) IS
        BEGIN
            FOR i IN 0..cnt - 1 LOOP
                huffman_tree(bit_string(start_symbol + i, bit_cnt)) := start_code + i;
            END LOOP;
        END;

    BEGIN
        dbms_lob.createtemporary(l_rv, TRUE, c_lob_duration);
        l_len := dbms_lob.getlength(p_cmpr);
        LOOP
            l_final := get_1bit > 0;
            l_type := get_1bit + 2 * get_1bit;
            IF l_type = 2 THEN
                handle_dynamic_huffman_block;
            ELSIF l_type = 1 THEN
                IF l_fixed_literal_tree.count = 0 THEN
                    add_codes_to_tree(l_fixed_literal_tree, 8, 144, 48, 0);
                    add_codes_to_tree(l_fixed_literal_tree, 9, 112, 400, 144);
                    add_codes_to_tree(l_fixed_literal_tree, 7, 24, 0, 256);
                    add_codes_to_tree(l_fixed_literal_tree, 8, 8, 192, 280);
                    FOR i IN 0..31 LOOP
                        l_fixed_distance_tree(bit_string(i, 5)) := i;
                    END LOOP;

                END IF;

                inflate_huffman(l_fixed_literal_tree, l_fixed_distance_tree);
            ELSIF l_type = 0 THEN
                l_bit_idx := 256; -- ignore remaining bits in current byte
                l_idx := l_idx - length(l_buf) / 2; -- reset in file to before current buffer
                l_idx := l_idx + ( l_buf_idx - 1 ) / 2; -- add again processed part of buffer
                l_len_stored := TO_NUMBER ( utl_raw.reverse(dbms_lob.substr(p_cmpr, 2, l_idx)), 'XXXX' );

                l_idx := l_idx + 4; -- skip LEN and NLEN
                IF l_len_stored = 0 THEN
                    NULL;
                ELSE
                    FOR i IN 0..trunc((l_len_stored - 1) / 16383) LOOP
                        add2_sliding_window(dbms_lob.substr(p_cmpr,
                                                            least(l_len_stored - i * 16383, 16383),
                                                            l_idx + i * 16383));
                    END LOOP;
                END IF;

                l_buf_idx := 32767; -- mark buffer as empty
            ELSE
                RAISE no_data_found;
            END IF;

            IF
                p_max_uncompressed_len IS NOT NULL
                AND dbms_lob.getlength(l_rv) > p_max_uncompressed_len
            THEN
                raise_application_error(-20032, 'file length will be larger than allowed size of '
                                                || p_max_uncompressed_len
                                                || ' bytes');
            END IF;

            EXIT WHEN l_final;
        END LOOP;

        slw2rv(l_slw_idx - 1);
        IF
            p_max_uncompressed_len IS NOT NULL
            AND dbms_lob.getlength(l_rv) > p_max_uncompressed_len
        THEN
            raise_application_error(-20033, 'file length will be larger than allowed size of '
                                            || p_max_uncompressed_len
                                            || ' bytes');
        END IF;

        RETURN l_rv;
    END inflate;
  --
    PROCEDURE init_zipcrypto_tab IS
        l_poly RAW(4) := hextoraw('EDB88320');
        l_tmp  INTEGER;
    BEGIN
        FOR i IN 0..255 LOOP
            l_tmp := i;
            FOR j IN 1..8 LOOP
                IF MOD(l_tmp, 2) = 1 THEN
                    l_tmp := TO_NUMBER ( rawtohex(utl_raw.bit_xor(
                        hextoraw(to_char(
                            trunc(l_tmp / 2),
                            'fm0xxxxxxx'
                        )),
                        l_poly
                    )), 'xxxxxxxx' );

                ELSE
                    l_tmp := trunc(l_tmp / 2);
                END IF;
            END LOOP;

            l_zipcrypto_tab(to_char(i, 'fm0X')) := hextoraw(to_char(l_tmp, 'fm0xxxxxxx'));

        END LOOP;
    END init_zipcrypto_tab;
  --
    PROCEDURE update_keys (
        p_char RAW
    ) IS
        l_crc RAW(4);
        l_tmp NUMBER;
    BEGIN
        l_key1 := utl_raw.bit_xor(
            l_zipcrypto_tab(utl_raw.bit_xor(p_char,
                                            utl_raw.substr(l_key1, 4, 1))),
            utl_raw.concat(
                    hextoraw('00'),
                    utl_raw.substr(l_key1, 1, 3)
                )
        );

        l_tmp := MOD((TO_NUMBER(rawtohex(l_key2),
    'xxxxxxxx') + TO_NUMBER(rawtohex(utl_raw.substr(l_key1, 4, 1)),
    'xx')) * 134775813 + 1,
                     4294967296);

        l_key2 := hextoraw(to_char(l_tmp, 'fm0XXXXXXX'));
        l_key3 := utl_raw.bit_xor(
            l_zipcrypto_tab(utl_raw.bit_xor(
                utl_raw.substr(l_key2, 1, 1),
                utl_raw.substr(l_key3, 4, 1)
            )),
            utl_raw.concat(
                    hextoraw('00'),
                    utl_raw.substr(l_key3, 1, 3)
                )
        );

    END update_keys;
  --
    PROCEDURE init_keys (
        p_password RAW
    ) IS
    BEGIN
        l_key1 := hextoraw('12345678');
        l_key2 := hextoraw('23456789');
        l_key3 := hextoraw('34567890');
        FOR i IN 1..nvl(
            utl_raw.length(p_password),
            0
        ) LOOP
            update_keys(utl_raw.substr(p_password, i, 1));
        END LOOP;

    END init_keys;
  --
    FUNCTION zipcrypto_crypt (
        p_chr RAW
    ) RETURN RAW IS
        l_tmp RAW(4);
    BEGIN
        l_tmp := utl_raw.bit_or(l_key3,
                                hextoraw('00000002'));
        l_tmp := to_char(
            MOD(TO_NUMBER(l_tmp,
                'xxxxxxxx') * TO_NUMBER(utl_raw.bit_xor(l_tmp,
                                                        hextoraw('00000001')),
                'xxxxxxxx'),
                4294967296),
            'fm0xxxxxxx'
        );

        l_tmp := utl_raw.bit_xor(p_chr,
                                 utl_raw.substr(l_tmp, 3, 1));

        RETURN l_tmp;
    END zipcrypto_crypt;
  --
    FUNCTION little_endian (
        p_big   NUMBER,
        p_bytes PLS_INTEGER := 4
    ) RETURN RAW IS
    BEGIN
        RETURN utl_raw.reverse(to_char(p_big,
                                       'fm'
                                       || rpad('0', 2 * p_bytes, 'X')));
    END;
  --
    FUNCTION little_endian (
        p_num   RAW,
        p_pos   PLS_INTEGER := 1,
        p_bytes PLS_INTEGER := NULL
    ) RETURN INTEGER IS
    BEGIN
        RETURN TO_NUMBER ( utl_raw.reverse(utl_raw.substr(p_num, p_pos, p_bytes)), 'XXXXXXXXXXXXXXXX' );
    END;
  --
    FUNCTION get_encoding (
        p_encoding VARCHAR2 := NULL
    ) RETURN VARCHAR2 IS
        l_encoding VARCHAR2(32767);
    BEGIN
        IF p_encoding IS NOT NULL THEN
            IF nls_charset_id(p_encoding) IS NULL THEN
                l_encoding := utl_i18n.map_charset(p_encoding, utl_i18n.generic_context, utl_i18n.iana_to_oracle);
            ELSE
                l_encoding := p_encoding;
            END IF;
        END IF;

        RETURN coalesce(l_encoding, 'US8PC437'); -- IBM codepage 437
    END get_encoding;
  --
    FUNCTION char2raw (
        p_txt      VARCHAR2 CHARACTER SET any_cs,
        p_encoding VARCHAR2 := NULL
    ) RETURN RAW IS
    BEGIN
        IF isnchar(p_txt) THEN -- on my 12.1 database, which is not AL32UTF8,
         -- utl_i18n.string_to_raw( p_txt, get_encoding( p_encoding ) does not work
            RETURN utl_raw.convert(
                utl_i18n.string_to_raw(p_txt),
                get_encoding(p_encoding),
                nls_charset_name(nls_charset_id('NCHAR_CS'))
            );
        END IF;

        RETURN utl_i18n.string_to_raw(p_txt,
                                      get_encoding(p_encoding));
    END;
  --
    FUNCTION get_64k_raw (
        p_raw1     RAW,
        p_raw2     RAW,
        p_raw3     RAW,
        p_encoding VARCHAR2 := NULL
    ) RETURN CLOB IS

        l_rv          CLOB;
        l_tmp         BLOB;
        l_dest_offset INTEGER := 1;
        l_src_offset  INTEGER := 1;
        l_context     INTEGER := dbms_lob.default_lang_ctx;
        l_warning     INTEGER;
        l_csid        INTEGER := nls_charset_id(coalesce(p_encoding, 'CHAR_CS'));
    BEGIN
        IF p_raw1 IS NULL THEN
            RETURN NULL;
        END IF;
        BEGIN
            IF p_raw2 IS NULL THEN
                RETURN utl_i18n.raw_to_char(p_raw1, p_encoding);
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        l_tmp := p_raw1;
        IF p_raw2 IS NOT NULL THEN
            dbms_lob.writeappend(l_tmp,
                                 utl_raw.length(p_raw2),
                                 p_raw2);
            IF p_raw3 IS NOT NULL THEN
                dbms_lob.writeappend(l_tmp,
                                     utl_raw.length(p_raw3),
                                     p_raw3);
            END IF;

        END IF;

        dbms_lob.createtemporary(l_rv, TRUE);
        dbms_lob.converttoclob(l_rv, l_tmp, dbms_lob.lobmaxsize, l_dest_offset, l_src_offset,
                               l_csid, l_context, l_warning);

        dbms_lob.freetemporary(l_tmp);
        RETURN l_rv;
    END get_64k_raw;
  --
    PROCEDURE get_zip_info (
        p_zip         BLOB,
        p_info        OUT tp_zip_info,
        p_get_comment BOOLEAN := FALSE
    ) IS
        l_ind       INTEGER;
        l_buf_sz    PLS_INTEGER := 2024;
        l_start_buf INTEGER;
        l_buf       RAW(32767);
    BEGIN
        p_info.len := nvl(
            dbms_lob.getlength(p_zip),
            0
        );
        IF p_info.len < 22 THEN -- no (zip) file or empty zip file
            RETURN;
        END IF;
        l_start_buf := greatest(p_info.len - l_buf_sz + 1, 1);
        l_buf := dbms_lob.substr(p_zip, l_buf_sz, l_start_buf);
        l_ind := utl_raw.length(l_buf) - 21;
        LOOP
            EXIT WHEN l_ind < 1
            OR utl_raw.substr(l_buf, l_ind, 4) = c_end_of_central_directory;

            l_ind := l_ind - 1;
        END LOOP;

        IF l_ind > 0 THEN
            l_ind := l_ind + l_start_buf - 1;
        ELSE
            l_ind := p_info.len - 21;
            LOOP
                EXIT WHEN l_ind < 1
                OR dbms_lob.substr(p_zip, 4, l_ind) = c_end_of_central_directory;

                l_ind := l_ind - 1;
            END LOOP;

        END IF;

        IF l_ind <= 0 THEN
            raise_application_error(-20001, 'Error parsing the zipfile');
        END IF;
        l_buf := dbms_lob.substr(p_zip, 22, l_ind);
        IF utl_raw.substr(l_buf, 5, 2) != utl_raw.substr(l_buf, 7, 2)  -- this disk = disk with start of Central Dir
        OR utl_raw.substr(l_buf, 9, 2) != utl_raw.substr(l_buf, 11, 2) -- complete CD on this disk
         THEN
            raise_application_error(-20003, 'Error parsing the zipfile');
        END IF;

        p_info.idx_eocd := l_ind;
        p_info.zip64 :=
            l_ind > 21
            AND ( utl_raw.substr(l_buf, 5, 2) = 'FFFF'
            OR utl_raw.substr(l_buf, 7, 2) = 'FFFF'
            OR utl_raw.substr(l_buf, 9, 2) = 'FFFF'
            OR utl_raw.substr(l_buf, 11, 2) = 'FFFF'
            OR utl_raw.substr(l_buf, 13, 4) = 'FFFFFFFF'
            OR utl_raw.substr(l_buf, 17, 4) = 'FFFFFFFF'
            OR dbms_lob.substr(p_zip, 4, l_ind - 20) = c_zip64_end_of_cd_locator );

        IF p_info.zip64 THEN
            l_buf := dbms_lob.substr(p_zip, 20, l_ind - 20);
            IF utl_raw.substr(l_buf, 1, 4) != c_zip64_end_of_cd_locator -- Zip64 end of central directory locator
             THEN
                raise_application_error(-20018, 'Error parsing the zipfile');
            END IF;

            IF utl_raw.substr(l_buf, 5, 4) != '00000000'  -- disk with the start of the zip64 end of central directory
            OR utl_raw.substr(l_buf, 17, 4) != '01000000' -- total number of disks
             THEN
                raise_application_error(-20002, 'Error parsing the zipfile');
            END IF;

            l_ind := little_endian(l_buf, 9, 8) + 1;
            p_info.idx_zip64_eocd := l_ind;
            l_buf := dbms_lob.substr(p_zip, 64, l_ind);
            IF utl_raw.substr(l_buf, 1, 4) != c_zip64_end_of_cd -- Zip64 end of central directory
             THEN
                raise_application_error(-20019, 'Error parsing the zipfile');
            ELSIF utl_raw.substr(l_buf, 5, 8) != '2C00000000000000' THEN
                raise_application_error(-20022, 'zip64 extensible data sector not supported yet');
            END IF;

            p_info.cnt := little_endian(l_buf, 25, 8);
            p_info.idx_cd := little_endian(l_buf, 49, 8) + 1;
        ELSE
            p_info.idx_cd := little_endian(l_buf, 17, 4) + 1;
            p_info.cnt := little_endian(l_buf, 9, 2);
        END IF;

        p_info.len_cd := nvl(p_info.idx_zip64_eocd, p_info.idx_eocd) - p_info.idx_cd;

        p_info.len_comment := little_endian(l_buf, 21, 2);
        IF
            p_info.len_comment > 0
            AND p_get_comment
        THEN
      -- 32765, so size of comment and comment1 fit together in a raw(32767)
            p_info.comment1 := dbms_lob.substr(p_zip,
                                               least(p_info.len_comment, 32765),
                                               p_info.idx_eocd + 22);

            IF p_info.len_comment > 32765 THEN
                p_info.comment2 := dbms_lob.substr(p_zip,
                                                   least(p_info.len_comment - 32765, 32767),
                                                   p_info.idx_eocd + 22 + 32765);

            END IF;

            IF p_info.len_comment > 65532 THEN
                p_info.comment3 := dbms_lob.substr(p_zip,
                                                   least(p_info.len_comment - 65532, 100),
                                                   p_info.idx_eocd + 22 + 65532);
            END IF;

        END IF;

    END get_zip_info;
  --
    FUNCTION parse_file (
        p_zipped_blob          BLOB,
        p_fh                   IN OUT tp_cfh,
        p_password             RAW,
        p_max_uncompressed_len NUMBER
    ) RETURN BLOB IS

        l_rv                 BLOB;
        l_deflate            BLOB;
        l_rv_buf             VARCHAR2(32766);
        l_buf                RAW(3999);
        l_compression_method VARCHAR2(4);
        l_n                  INTEGER;
        l_m                  INTEGER;
        l_crypto_2do         INTEGER;
        l_crypto_byte        RAW(1);
        l_crypto_buf         VARCHAR2(32767);
        c_crypto_sz          CONSTANT PLS_INTEGER := 16383; -- size in bytes
        l_crc                RAW(4);
        l_len                INTEGER;
        l_winzip_encrypted   BOOLEAN;
        l_lz_buf             RAW(32766);
        l_hdl                BINARY_INTEGER;
        l_idx                INTEGER;
        l_key_bits           PLS_INTEGER;
        l_key_len            PLS_INTEGER;
        l_salt_len           PLS_INTEGER;
        l_salt               RAW(16);
        l_key                RAW(80);
        l_mac                RAW(20);
        l_sum                RAW(20);
        l_block#             INTEGER;
        l_decrypted          RAW(128);

    --
        FUNCTION zipcrypto_decrypt (
            p_chr RAW
        ) RETURN RAW IS
            l_tmp RAW(4) := zipcrypto_crypt(p_chr);
        BEGIN
            update_keys(l_tmp);
            RETURN l_tmp;
        END;

    BEGIN
        IF p_fh.original_len IS NULL THEN
            raise_application_error(-20006, 'File not found');
        END IF;
        IF nvl(p_fh.original_len, 0) = 0 THEN
            RETURN empty_blob();
        END IF;

        l_buf := dbms_lob.substr(p_zipped_blob, 30, p_fh.offset + 1);
        IF utl_raw.substr(l_buf, 1, 4) != c_local_file_header THEN
            raise_application_error(-20007, 'Error parsing the zipfile');
        END IF;

        l_compression_method := utl_raw.substr(l_buf, 9, 2);
        l_n := little_endian(l_buf, 27, 2);
        l_m := little_endian(l_buf, 29, 2);
        dbms_lob.createtemporary(l_rv, TRUE, c_lob_duration);
        IF bitand(TO_NUMBER(utl_raw.substr(l_buf, 7, 1),
       'XX'),
                  1) > 0 THEN
            IF p_password IS NULL
               OR utl_raw.length(p_password) = 0 THEN
                raise_application_error(-20009, 'No password provided');
            END IF;

            IF l_compression_method = '6300' THEN -- Winzip AES encrypted
                l_winzip_encrypted := TRUE;
                IF l_m < 11
                OR l_m > 32767 THEN
                    raise_application_error(-20010, 'Error parsing the zipfile');
                END IF;

                l_crypto_buf := dbms_lob.substr(p_zipped_blob, l_m, p_fh.offset + 31 + l_n);

                l_idx := 1;
                LOOP
                    EXIT WHEN utl_raw.substr(l_crypto_buf, l_idx, 2) = '0199'; -- AE-x encryption structure
                    l_idx := l_idx + TO_NUMBER ( utl_raw.reverse(utl_raw.substr(l_crypto_buf, l_idx + 2, 2)), 'XXXX' );

                    EXIT WHEN l_idx > l_m;
                END LOOP;

                IF l_idx > l_m
                OR utl_raw.substr(l_crypto_buf, l_idx, 8) NOT IN ( '0199070001004145', '0199070002004145' ) THEN -- AE-x encryption structure AE1 or AE2
                    raise_application_error(-20011, 'Error parsing the zipfile');
                END IF;

                l_compression_method := utl_raw.substr(l_crypto_buf, l_idx + 9, 2);
                l_key_bits :=
                    CASE utl_raw.substr(l_crypto_buf, l_idx + 8, 1)
                        WHEN '01' THEN
                            128
                        WHEN '02' THEN
                            192
                        WHEN '03' THEN
                            256
                    END;

                IF l_key_bits IS NULL THEN
                    raise_application_error(-20012, 'Error parsing the zipfile');
                END IF;
                l_key_len := l_key_bits / 4 + 2;
                l_salt_len := l_key_bits / 16;
                l_crypto_buf := dbms_lob.substr(p_zipped_blob, l_salt_len + 2, p_fh.offset + 31 + l_n + l_m);

                l_salt := utl_raw.substr(l_crypto_buf, 1, l_salt_len);
                FOR i IN 1..ceil(l_key_len / 20) LOOP
                    l_mac := dbms_crypto.mac(
                        utl_raw.concat(l_salt,
                                       to_char(i, 'fm0xxxxxxx')),
                        dbms_crypto.hmac_sh1,
                        p_password
                    );

                    l_sum := l_mac;
                    FOR j IN 1..999 LOOP
                        l_mac := dbms_crypto.mac(l_mac, dbms_crypto.hmac_sh1, p_password);
                        l_sum := utl_raw.bit_xor(l_mac, l_sum);
                    END LOOP;

                    l_key := utl_raw.concat(l_key, l_sum);
                END LOOP;

                l_key := utl_raw.substr(l_key, 1, l_key_len);
                IF utl_raw.substr(l_crypto_buf, l_salt_len + 1) != utl_raw.substr(l_key, -2, 2) -- Password verification value
                 THEN
                    raise_application_error(-20013, 'Wrong password provided');
                END IF;

                l_key := utl_raw.substr(l_key, 1, l_key_bits / 8);
                l_crypto_2do := p_fh.compressed_len - l_salt_len - 2 - 10; -- Password verification value and authentication code
                l_idx := p_fh.offset + 31 + l_n + l_m + l_salt_len + 2;
                l_block# := 1;
                LOOP
                    EXIT WHEN l_crypto_2do <= 0;
                    l_rv_buf := NULL;
                    l_crypto_buf := dbms_lob.substr(p_zipped_blob,
                                                    least(16368, l_crypto_2do),
                                                    l_idx);

                    FOR i IN 0..trunc((utl_raw.length(l_crypto_buf) - 1) / 16) LOOP
                        l_decrypted := dbms_crypto.encrypt(
                            utl_raw.reverse(to_char(l_block#,
                                                    'fm'
                                                    || lpad('X', 32, '0'))),
                            dbms_crypto.encrypt_aes + dbms_crypto.chain_ecb + dbms_crypto.pad_none,
                            l_key
                        );

                        l_rv_buf := utl_raw.concat(l_rv_buf,
                                                   utl_raw.bit_xor(
                                                                       utl_raw.substr(l_crypto_buf,
                                                                                      1 + i * 16,
                                                                                      least(16, l_crypto_2do - i * 16)),
                                                                       utl_raw.substr(l_decrypted,
                                                                                      1,
                                                                                      least(16, l_crypto_2do - i * 16))
                                                                   ));

                        l_block# := l_block# + 1;
                    END LOOP;

                    l_idx := l_idx + 16368;
                    l_crypto_2do := l_crypto_2do - 16368;
                    dbms_lob.writeappend(l_rv,
                                         utl_raw.length(l_rv_buf),
                                         l_rv_buf);
                END LOOP;

            ELSE -- ZipCrypto
                init_zipcrypto_tab;
                init_keys(p_password);
                l_crc := 'FFFFFFFF';
                l_crypto_2do := p_fh.compressed_len;
                FOR i IN 0..trunc((p_fh.compressed_len - 1) / c_crypto_sz) LOOP
                    l_crypto_buf := dbms_lob.substr(p_zipped_blob, c_crypto_sz, p_fh.offset + 31 + l_n + l_m + i * c_crypto_sz);

                    FOR j IN 0..least(c_crypto_sz, l_crypto_2do) - 1 LOOP
                        l_crypto_byte := zipcrypto_decrypt(substr(l_crypto_buf, j * 2 + 1, 2));

                        IF i > 0
                        OR j > 11 THEN
                            l_rv_buf := l_rv_buf || l_crypto_byte;
                            l_crc := utl_raw.bit_xor('00'
                                                     || utl_raw.substr(l_crc, 1, 3),
                                                     l_zipcrypto_tab(utl_raw.bit_xor(l_crypto_byte,
                                                                                     utl_raw.substr(l_crc, 4, 1))));

                        END IF;

                    END LOOP;

                    l_crypto_2do := l_crypto_2do - c_crypto_sz;
                    dbms_lob.writeappend(l_rv,
                                         length(l_rv_buf) / 2,
                                         l_rv_buf);
                    l_rv_buf := NULL;
                END LOOP;

                l_crc := utl_raw.bit_xor(l_crc, 'FFFFFFFF');
            END IF;

        ELSE
            dbms_lob.copy(l_rv, p_zipped_blob, p_fh.compressed_len, 1, p_fh.offset + 31 + l_n + l_m);
        END IF;

        IF l_compression_method IN ( '0800', '0900' ) THEN
            l_deflate := hextoraw('1F8B0800000000000003'); -- gzip header
            dbms_lob.copy(l_deflate, l_rv, p_fh.compressed_len, 11, 1);
            IF l_winzip_encrypted IS NULL THEN
                dbms_lob.append(l_deflate,
                                utl_raw.concat(p_fh.crc32,
                                               utl_raw.substr(
                                  utl_raw.reverse(to_char(p_fh.original_len, 'fm0XXXXXXXXXXXXXXX')),
                                  1,
                                  4
                              )));
            END IF;

            BEGIN
                IF p_max_uncompressed_len IS NOT NULL
                   OR l_winzip_encrypted THEN
                    l_len := 0;
                    dbms_lob.freetemporary(l_rv);
                    dbms_lob.createtemporary(l_rv, TRUE, c_lob_duration);
                    l_hdl := utl_compress.lz_uncompress_open(l_deflate);
                    BEGIN
                        LOOP
                            utl_compress.lz_uncompress_extract(l_hdl, l_lz_buf);
                            l_len := l_len + nvl(
                                utl_raw.length(l_lz_buf),
                                0
                            );
                            IF l_len > p_max_uncompressed_len THEN
                                raise_application_error(-20031, 'file length will be larger than allowed size of '
                                                                || p_max_uncompressed_len
                                                                || ' bytes');
                            END IF;

                            dbms_lob.append(l_rv, l_lz_buf);
                        END LOOP;
                    EXCEPTION
                        WHEN no_data_found THEN
                            utl_compress.lz_uncompress_close(l_hdl);
                            RETURN l_rv;
                    END;

                END IF;

                RETURN utl_compress.lz_uncompress(l_deflate);
            EXCEPTION
                WHEN OTHERS THEN
                    RETURN inflate(l_rv, l_compression_method = '0900', p_max_uncompressed_len);
            END;

        ELSIF l_compression_method = '0000' THEN
            IF
                p_max_uncompressed_len IS NOT NULL
                AND dbms_lob.getlength(l_rv) > p_max_uncompressed_len
            THEN
                raise_application_error(-20030, 'file length will be larger than allowed size of '
                                                || p_max_uncompressed_len
                                                || ' bytes');
            END IF;

            RETURN l_rv;
        END IF;

        raise_application_error(-20008, 'Unhandled compression method ' || l_compression_method);
    END parse_file;
  --
    FUNCTION file2blob (
        p_dir       VARCHAR2,
        p_file_name VARCHAR2
    ) RETURN BLOB IS
        file_lob    BFILE;
        file_blob   BLOB;
        dest_offset INTEGER := 1;
        src_offset  INTEGER := 1;
    BEGIN
        file_lob := bfilename(p_dir, p_file_name);
        dbms_lob.open(file_lob, dbms_lob.file_readonly);
        dbms_lob.createtemporary(file_blob, TRUE, c_lob_duration);
        dbms_lob.loadblobfromfile(file_blob, file_lob, dbms_lob.lobmaxsize, dest_offset, src_offset);
        dbms_lob.close(file_lob);
        RETURN file_blob;
    EXCEPTION
        WHEN OTHERS THEN
            IF dbms_lob.isopen(file_lob) = 1 THEN
                dbms_lob.close(file_lob);
            END IF;

            IF dbms_lob.istemporary(file_blob) = 1 THEN
                dbms_lob.freetemporary(file_blob);
            END IF;

            RAISE;
    END file2blob;
  --
    FUNCTION parse_central_file_header (
        p_zip         BLOB,
        p_ind         INTEGER,
        p_cfh         OUT tp_cfh,
        p_get_comment BOOLEAN := FALSE
    ) RETURN BOOLEAN IS
        l_tmp PLS_INTEGER;
        l_len PLS_INTEGER;
        l_buf RAW(32767);
    BEGIN
        l_buf := dbms_lob.substr(p_zip, 46, p_ind);
        IF utl_raw.substr(l_buf, 1, 4) != c_central_file_header THEN
            RETURN FALSE;
        END IF;

        p_cfh.crc32 := utl_raw.substr(l_buf, 17, 4);
        p_cfh.n := little_endian(l_buf, 29, 2);
        p_cfh.m := little_endian(l_buf, 31, 2);
        p_cfh.k := little_endian(l_buf, 33, 2);
        p_cfh.external_file_attr := utl_raw.substr(l_buf, 39, 4);
        p_cfh.len := 46 + p_cfh.n + p_cfh.m + p_cfh.k;
    --
        p_cfh.encrypted := bitand(TO_NUMBER(utl_raw.substr(l_buf, 9, 1),
       'XX'),
                                  1) > 0;

        p_cfh.utf8 := bitand(TO_NUMBER(utl_raw.substr(l_buf, 10, 1),
       'XX'),
                             8) > 0;

        IF p_cfh.n > 0 THEN
            p_cfh.name1 := dbms_lob.substr(p_zip,
                                           least(p_cfh.n, 32767),
                                           p_ind + 46);

            IF p_cfh.n > 32767 THEN
                p_cfh.name2 := dbms_lob.substr(p_zip,
                                               least(p_cfh.n - 32767, 32767),
                                               p_ind + 46 + 32767);

            END IF;

            IF p_cfh.n > 65534 THEN
                p_cfh.name3 := dbms_lob.substr(p_zip,
                                               least(p_cfh.n - 65534, 100),
                                               p_ind + 46 + 65534);
            END IF;

        END IF;
    --
        p_cfh.compressed_len := little_endian(l_buf, 21, 4);
        p_cfh.original_len := little_endian(l_buf, 25, 4);
        p_cfh.offset := little_endian(l_buf, 43, 4);
        p_cfh.zip64_offset := NULL;
        IF p_cfh.compressed_len = 4294967295 -- FFFFFFFF
        OR p_cfh.original_len = 4294967295
        OR p_cfh.offset = 4294967295 THEN
            IF p_cfh.m < 12 THEN -- we need a zip64 extension
                raise_application_error(-20004, 'Error parsing the zipfile');
            END IF;
            IF p_cfh.m > 32767 THEN
                raise_application_error(-20005, 'extra field too large to handle');
            END IF;
            l_buf := dbms_lob.substr(p_zip, p_cfh.m, p_ind + 46 + p_cfh.n);

            l_tmp := 1;
            LOOP
                EXIT WHEN utl_raw.substr(l_buf, l_tmp, 2) = '0100';
                l_len := little_endian(l_buf, l_tmp + 2, 2);
                l_tmp := l_tmp + 4 + l_len;
                IF l_tmp >= p_cfh.m - 2 THEN
                    l_tmp := 0;
                    EXIT;
                END IF;

            END LOOP;

            IF l_tmp > 0 THEN
                l_len := little_endian(l_buf, l_tmp + 2, 2);
                l_tmp := l_tmp + 4;
                IF p_cfh.original_len = 4294967295 THEN
                    p_cfh.original_len := little_endian(l_buf, l_tmp, 8);
                    l_tmp := l_tmp + 8;
                END IF;

                IF p_cfh.compressed_len = 4294967295 THEN
                    p_cfh.compressed_len := little_endian(l_buf, l_tmp, 8);
                    l_tmp := l_tmp + 8;
                END IF;

                IF p_cfh.offset = 4294967295 THEN
                    p_cfh.offset := little_endian(l_buf, l_tmp, 8);
                    p_cfh.zip64_offset := 46 + p_cfh.n + l_tmp;
                END IF;

            END IF;

        END IF;
    --
        IF
            p_cfh.k > 0
            AND p_get_comment
        THEN
      -- 32765, so size of comment and comment1 fit together in a raw(32767)
            p_cfh.comment1 := dbms_lob.substr(p_zip,
                                              least(p_cfh.k, 32765),
                                              p_ind + 46 + p_cfh.n + p_cfh.m);

            IF p_cfh.k > 32765 THEN
                p_cfh.comment2 := dbms_lob.substr(p_zip,
                                                  least(p_cfh.k - 32765, 32767),
                                                  p_ind + 46 + p_cfh.n + p_cfh.m + 32765);

            END IF;

            IF p_cfh.k > 65532 THEN
                p_cfh.comment3 := dbms_lob.substr(p_zip,
                                                  least(p_cfh.k - 65532, 100),
                                                  p_ind + 46 + p_cfh.n + p_cfh.m + 65532);
            END IF;

        END IF;
    --
        RETURN TRUE;
    END parse_central_file_header;
  --
    PROCEDURE write_eocd (
        p_zip         IN OUT NOCOPY BLOB,
        p_force_zip64 BOOLEAN,
        p_count       INTEGER,
        p_len_cd      INTEGER,
        p_offs_cd     INTEGER,
        p_info        tp_zip_info
    ) IS
    BEGIN
        IF p_force_zip64
        OR p_count >= 65535 -- FFFF
         THEN
            dbms_lob.writeappend(p_zip,
                                 96,
                                 utl_raw.concat(c_zip64_end_of_cd,
                                                '2C000000000000002D002D000000000000000000',
                                                little_endian(p_count, 8),
                                                little_endian(p_count, 8),
                                                little_endian(p_len_cd, 8),
                                                little_endian(p_offs_cd, 8),
                                                c_zip64_end_of_cd_locator,
                                                '00000000',
                                                little_endian(p_offs_cd + p_len_cd, 8),
                                                '01000000',
                                                c_end_of_central_directory,
                                                'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'));
        ELSE
            dbms_lob.writeappend(p_zip,
                                 20,
                                 utl_raw.concat(c_end_of_central_directory,
                                                '00000000',
                                                little_endian(p_count, 2),
                                                little_endian(p_count, 2),
                                                little_endian(p_len_cd),
                                                little_endian(p_offs_cd)));
        END IF;

        dbms_lob.writeappend(p_zip,
                             p_info.len_comment + 2,
                             utl_raw.concat(
                        little_endian(p_info.len_comment, 2),
                        p_info.comment1
                    ));

        IF p_info.comment2 IS NOT NULL THEN
            dbms_lob.writeappend(p_zip,
                                 utl_raw.length(p_info.comment2),
                                 p_info.comment2);
        END IF;

        IF p_info.comment3 IS NOT NULL THEN
            dbms_lob.writeappend(p_zip,
                                 utl_raw.length(p_info.comment3),
                                 p_info.comment3);
        END IF;

    END write_eocd;
  --
    PROCEDURE get_files (
        p_zipped_blob      BLOB,
        p_encoding         VARCHAR2 := NULL,
        p_start_entry      INTEGER := NULL,
        p_max_entries      INTEGER := NULL,
        p_filter           VARCHAR2 := NULL,
        p_case_insensitive BOOLEAN := NULL,
        p_list             BOOLEAN,
        p_file_list        OUT file_list,
        p_file_names       OUT file_names
    ) IS

        l_info     tp_zip_info;
        l_cfh      tp_cfh;
        l_ind      INTEGER;
        l_idx      INTEGER;
        l_encoding VARCHAR2(3999);
        l_name     CLOB;
        l_cnt      PLS_INTEGER := 0;
    BEGIN
        IF p_list THEN
            p_file_list := file_list();
        ELSE
            p_file_names := file_names();
        END IF;
    --
        get_zip_info(p_zipped_blob, l_info);
        IF nvl(l_info.cnt, 0) < 1 THEN -- no (zip) file or empty zip file
            RETURN;
        END IF;
    --
        l_encoding := get_encoding(p_encoding);
        l_idx := 1;
        l_ind := l_info.idx_cd;
        LOOP
            EXIT WHEN nvl(p_start_entry, 1) - 1 + p_max_entries < l_idx
            OR NOT parse_central_file_header(p_zipped_blob, l_ind, l_cfh);

            IF l_idx >= nvl(p_start_entry, 1) THEN
                IF p_list THEN
                    l_name := get_64k_raw(l_cfh.name1, l_cfh.name2, l_cfh.name3,
                                          CASE
                                              WHEN l_cfh.utf8 THEN
                                                  'AL32UTF8'
                                              ELSE
                                                  l_encoding
                                          END
                    );

                    IF p_filter IS NULL
                       OR l_name LIKE p_filter
                    OR (
                        p_case_insensitive
                        AND upper(l_name) LIKE upper(p_filter)
                    )
                    OR regexp_like(l_name, p_filter,
                                   CASE
                                       WHEN p_case_insensitive THEN
                                           'i'
                                   END
                    ) THEN
                        l_cnt := l_cnt + 1;
                        p_file_list.extend;
                        p_file_list(l_cnt) := l_name;
                    END IF;

                    l_name := NULL;
                ELSE
                    l_name := utl_i18n.raw_to_char(l_cfh.name1,
                                                   CASE
                                                       WHEN l_cfh.utf8 THEN
                                                           'AL32UTF8'
                                                       ELSE
                                                           l_encoding
                                                   END
                    );

                    IF p_filter IS NULL
                       OR l_name LIKE p_filter
                    OR (
                        p_case_insensitive
                        AND upper(l_name) LIKE upper(p_filter)
                    )
                    OR regexp_like(l_name, p_filter,
                                   CASE
                                       WHEN p_case_insensitive THEN
                                           'i'
                                   END
                    ) THEN
                        l_cnt := l_cnt + 1;
                        p_file_names.extend;
                        p_file_names(l_cnt) := l_name;
                    END IF;

                END IF;

            END IF;

            l_ind := l_ind + l_cfh.len;
            l_idx := l_idx + 1;
        END LOOP;
    --
    END get_files;
  --
    FUNCTION get_file_list (
        p_zipped_blob      BLOB,
        p_encoding         VARCHAR2 := NULL,
        p_start_entry      INTEGER := NULL,
        p_max_entries      INTEGER := NULL,
        p_filter           VARCHAR2 := NULL,
        p_case_insensitive BOOLEAN := NULL
    ) RETURN file_list IS
        l_file_list  file_list;
        l_file_names file_names;
    BEGIN
        get_files(p_zipped_blob, p_encoding, p_start_entry, p_max_entries, p_filter,
                  p_case_insensitive, TRUE, l_file_list, l_file_names);

        RETURN l_file_list;
    END;
  --
    FUNCTION get_file_list (
        p_dir              VARCHAR2,
        p_zip_file         VARCHAR2,
        p_encoding         VARCHAR2 := NULL,
        p_start_entry      INTEGER := NULL,
        p_max_entries      INTEGER := NULL,
        p_filter           VARCHAR2 := NULL,
        p_case_insensitive BOOLEAN := NULL
    ) RETURN file_list IS
    BEGIN
        RETURN get_file_list(
            file2blob(p_dir, p_zip_file),
            p_encoding,
            p_start_entry,
            p_max_entries,
            p_filter,
            p_case_insensitive
        );
    END;
  --
    FUNCTION get_file_names (
        p_zipped_blob      BLOB,
        p_encoding         VARCHAR2 := NULL,
        p_start_entry      INTEGER := NULL,
        p_max_entries      INTEGER := NULL,
        p_filter           VARCHAR2 := NULL,
        p_case_insensitive BOOLEAN := NULL
    ) RETURN file_names IS
        l_file_list  file_list;
        l_file_names file_names;
    BEGIN
        get_files(p_zipped_blob, p_encoding, p_start_entry, p_max_entries, p_filter,
                  p_case_insensitive, FALSE, l_file_list, l_file_names);

        RETURN l_file_names;
    END;
  --
    FUNCTION get_file_names (
        p_dir              VARCHAR2,
        p_zip_file         VARCHAR2,
        p_encoding         VARCHAR2 := NULL,
        p_start_entry      INTEGER := NULL,
        p_max_entries      INTEGER := NULL,
        p_filter           VARCHAR2 := NULL,
        p_case_insensitive BOOLEAN := NULL
    ) RETURN file_names IS
    BEGIN
        RETURN get_file_names(
            file2blob(p_dir, p_zip_file),
            p_encoding,
            p_start_entry,
            p_max_entries,
            p_filter,
            p_case_insensitive
        );
    END;
  --
    FUNCTION get_central_file_header (
        p_zip      BLOB,
        p_name     VARCHAR2 CHARACTER SET any_cs,
        p_idx      NUMBER,
        p_encoding VARCHAR2,
        p_cfh      OUT tp_cfh
    ) RETURN BOOLEAN IS

        l_rv        BOOLEAN;
        l_ind       INTEGER;
        l_idx       INTEGER;
        l_info      tp_zip_info;
        l_name      RAW(32767);
        l_utf8_name RAW(32767);
    BEGIN
        IF
            p_name IS NULL
            AND p_idx IS NULL
        THEN
            RETURN FALSE;
        END IF;
        get_zip_info(p_zip, l_info, TRUE);
        IF nvl(l_info.cnt, 0) < 1 THEN -- no (zip) file or empty zip file
            RETURN FALSE;
        END IF;
    --
        IF p_name IS NOT NULL THEN
            l_name := char2raw(p_name, p_encoding);
            l_utf8_name := char2raw(p_name, 'AL32UTF8');
        END IF;
    --
        l_rv := FALSE;
        l_ind := l_info.idx_cd;
        l_idx := 1;
        LOOP
            EXIT WHEN NOT parse_central_file_header(p_zip, l_ind, p_cfh, TRUE);
            IF l_idx = p_idx
            OR p_cfh.name1 =
                CASE
                    WHEN p_cfh.utf8 THEN
                        l_utf8_name
                    ELSE
                        l_name
                END
            THEN
                l_rv := TRUE;
                EXIT;
            END IF;

            l_ind := l_ind + p_cfh.len;
            l_idx := l_idx + 1;
        END LOOP;
    --
        p_cfh.idx := l_idx;
        p_cfh.encoding := get_encoding(p_encoding);
        RETURN l_rv;
    END get_central_file_header;
  --
    FUNCTION get_file (
        p_zipped_blob BLOB,
        p_file_name   VARCHAR2 CHARACTER SET any_cs := NULL,
        p_encoding    VARCHAR2 := NULL,
        p_idx         NUMBER := NULL,
        p_password    VARCHAR2 := NULL
    ) RETURN BLOB IS
        l_cfh tp_cfh;
    BEGIN
        IF NOT get_central_file_header(p_zipped_blob, p_file_name, p_idx, p_encoding, l_cfh) THEN
            RETURN NULL;
        END IF;

        RETURN parse_file(p_zipped_blob,
                          l_cfh,
                          utl_raw.cast_to_raw(p_password),
                          NULL);
    END get_file;
  --
    FUNCTION get_file (
        p_dir       VARCHAR2,
        p_zip_file  VARCHAR2,
        p_file_name VARCHAR2 CHARACTER SET any_cs := NULL,
        p_encoding  VARCHAR2 := NULL,
        p_idx       NUMBER := NULL,
        p_password  VARCHAR2 := NULL
    ) RETURN BLOB IS
    BEGIN
        RETURN get_file(
            file2blob(p_dir, p_zip_file),
            p_file_name,
            p_encoding,
            p_idx,
            p_password
        );
    END;
  --
    FUNCTION encrypt (
        p_pw        VARCHAR2,
        p_src       BLOB,
        p_crc32     RAW,
        p_zipcrypto BOOLEAN
    ) RETURN BLOB IS

        l_rv         BLOB;
        l_pw         RAW(32767) := utl_raw.cast_to_raw(p_pw);
        l_salt       RAW(16);
        l_key        RAW(32);
        l_key_bits   PLS_INTEGER := 256;
        l_key_length PLS_INTEGER := l_key_bits / 8 * 2 + 2;
        l_cnt        PLS_INTEGER := 1000;
        l_keys       RAW(32767);
        l_sum        RAW(32767);
        l_mac        RAW(20);
        l_block      RAW(16);
        l_encrypted  RAW(16);
        l_len        PLS_INTEGER;
        l_tmp        BLOB;
        l_buf        VARCHAR2(32767);
        l_buf2       VARCHAR2(32767);
  --
        FUNCTION zipcrypto_encrypt (
            p_chr RAW
        ) RETURN RAW IS
            l_tmp RAW(4) := zipcrypto_crypt(p_chr);
        BEGIN
            update_keys(p_chr);
            RETURN l_tmp;
        END;

    BEGIN
        IF p_zipcrypto THEN
            init_zipcrypto_tab;
            init_keys(l_pw);
            FOR i IN 1..11 LOOP
                l_buf2 := l_buf2
                          || zipcrypto_encrypt(to_char(
                    trunc(dbms_random.value(0, 256)),
                    'fmXX'
                ));
            END LOOP;

            l_buf2 := l_buf2
                      || zipcrypto_encrypt(utl_raw.substr(p_crc32, 4, 1));

            dbms_lob.createtemporary(l_rv, TRUE, c_lob_duration);
            FOR i IN 0..trunc((dbms_lob.getlength(p_src) - 1) / 16370) LOOP
                l_buf := dbms_lob.substr(p_src, 16370, i * 16370 + 1);
                FOR j IN 1..length(l_buf) / 2 LOOP
                    l_buf2 := l_buf2
                              || zipcrypto_encrypt(substr(l_buf, j * 2 - 1, 2));
                END LOOP;

                dbms_lob.writeappend(l_rv,
                                     length(l_buf2) / 2,
                                     l_buf2);
                l_buf2 := NULL;
            END LOOP;

            RETURN l_rv;
        END IF;

        l_salt := dbms_crypto.randombytes(l_key_bits / 16);
        FOR i IN 1..ceil(l_key_length / 20) LOOP
            l_mac := dbms_crypto.mac(
                utl_raw.concat(l_salt,
                               to_char(i, 'fm0xxxxxxx')),
                dbms_crypto.hmac_sh1,
                l_pw
            );

            l_sum := l_mac;
            FOR j IN 1..l_cnt - 1 LOOP
                l_mac := dbms_crypto.mac(l_mac, dbms_crypto.hmac_sh1, l_pw);
                l_sum := utl_raw.bit_xor(l_mac, l_sum);
            END LOOP;

            l_keys := utl_raw.concat(l_keys, l_sum);
        END LOOP;

        l_keys := utl_raw.substr(l_keys, 1, l_key_length);
        l_key := utl_raw.substr(l_keys, 1, l_key_bits / 8);
        l_rv := utl_raw.concat(l_salt,
                               utl_raw.substr(l_keys, -2, 2));
    --
        FOR i IN 0..trunc((dbms_lob.getlength(p_src) - 1) / 16) LOOP
            l_block := dbms_lob.substr(p_src, 16, i * 16 + 1);
            l_len := utl_raw.length(l_block);
            IF l_len < 16 THEN
                l_block := utl_raw.concat(l_block,
                                          utl_raw.copies('00', 16 - l_len));
            END IF;

            l_encrypted := dbms_crypto.encrypt(
                utl_raw.reverse(to_char(i + 1,
                                        'fm'
                                        || lpad('X', 32, '0'))),
                dbms_crypto.encrypt_aes256 + dbms_crypto.chain_ecb + dbms_crypto.pad_none,
                l_key
            );

            dbms_lob.writeappend(l_rv,
                                 l_len,
                                 utl_raw.bit_xor(l_block, l_encrypted));
        END LOOP;
    --
        dbms_lob.createtemporary(l_tmp, TRUE, c_lob_duration);
        dbms_lob.copy(l_tmp, l_rv, dbms_lob.lobmaxsize, 1, l_key_bits / 16 + 2 + 1);

        l_mac := dbms_crypto.mac(l_tmp,
                                 dbms_crypto.hmac_sh1,
                                 utl_raw.substr(l_keys, 1 + l_key_bits / 8, l_key_bits / 8));

        dbms_lob.freetemporary(l_tmp);
        dbms_lob.writeappend(l_rv, 10, l_mac);
        RETURN l_rv;
    END encrypt;
  --
    PROCEDURE add1file (
        p_zipped_blob IN OUT NOCOPY BLOB,
        p_name        VARCHAR2 CHARACTER SET any_cs,
        p_content     BLOB,
        p_password    VARCHAR2 := NULL,
        p_date        DATE := NULL,
        p_zipcrypto   BOOLEAN := NULL
    ) IS

        l_now        DATE;
        l_tmp        BLOB;
        l_blob       BLOB;
        l_len        INTEGER;
        l_clen       INTEGER;
        l_crc32      RAW(4) := hextoraw('00000000');
        l_compressed BOOLEAN := FALSE;
        l_name       RAW(32767);
        l_encrypted  BOOLEAN;
        l_extra      RAW(12);
    BEGIN
        l_now := coalesce(p_date, current_date);
        l_len := nvl(
            dbms_lob.getlength(p_content),
            0
        );
        IF l_len > 0 THEN
            l_tmp := utl_compress.lz_compress(p_content);
            l_clen := dbms_lob.getlength(l_tmp) - 18;
            l_compressed := l_clen < l_len;
            l_crc32 := dbms_lob.substr(l_tmp, 4, l_clen + 11);
        END IF;

        IF l_compressed THEN
            dbms_lob.createtemporary(l_blob, TRUE, c_lob_duration);
            dbms_lob.copy(l_blob, l_tmp, l_clen, 1, 11);
        ELSIF NOT l_compressed THEN
            l_clen := l_len;
            l_blob := p_content;
        END IF;

        IF p_zipped_blob IS NULL THEN
            dbms_lob.createtemporary(p_zipped_blob, TRUE, c_lob_duration);
        END IF;

        IF
            p_password IS NOT NULL
            AND l_len > 0
        THEN
            l_encrypted := TRUE;
            l_blob := encrypt(p_password, l_blob, l_crc32, p_zipcrypto);
            l_clen := dbms_lob.getlength(l_blob);
            IF NOT nvl(p_zipcrypto, FALSE) THEN
                l_crc32 := hextoraw('00000000');
                l_extra := hextoraw('019907000200414503' ||
                    CASE
                        WHEN l_compressed THEN
                            '0800' -- deflate
                        ELSE
                            '0000' -- stored
                    END
                );
            END IF;

        END IF;

        l_name := char2raw(p_name, 'AL32UTF8');
        dbms_lob.append(p_zipped_blob,
                        utl_raw.concat(c_local_file_header -- Local file header signature
                        ,
                                       CASE
                                           WHEN l_encrypted THEN
                                                   CASE
                                                       WHEN p_zipcrypto THEN
                                                           hextoraw('140001') -- version 2.0, encrypted
                                                       ELSE
                                                           hextoraw('330001') -- version 5.1, encrypted
                                                   END
                                           ELSE
                                               hextoraw('140000') -- version 2.0, not encrypted
                                       END,
                                       CASE
                                           WHEN l_name = char2raw(p_name)
                                                OR l_name IS NULL THEN
                                               hextoraw('00')
                                           ELSE
                                               hextoraw('08') -- set Language encoding flag (EFS)
                                       END,
                                       CASE
                                           WHEN l_encrypted
                                                AND NOT nvl(p_zipcrypto, FALSE) THEN
                                               '6300' -- AE-x encryption marker
                                           ELSE
                                               CASE
                                                   WHEN l_compressed THEN
                                                           hextoraw('0800') -- deflate
                                                   ELSE
                                                       hextoraw('0000') -- stored
                                               END
                                       END,
                                       little_endian(TO_NUMBER(to_char(l_now, 'ss')) / 2 + TO_NUMBER(to_char(l_now, 'mi')) * 32 + TO_NUMBER
                                       (to_char(l_now, 'hh24')) * 2048,
                                                     2) -- File last modification time
                                                     ,
                                       little_endian(TO_NUMBER(to_char(l_now, 'dd')) + TO_NUMBER(to_char(l_now, 'mm')) * 32 +(TO_NUMBER
                                       (to_char(l_now, 'yyyy')) - 1980) * 512,
                                                     2) -- File last modification date
                                                     ,
                                       l_crc32                                                 -- CRC-32
                                       ,
                                       little_endian(l_clen)                                 -- compressed size
                                       ,
                                       little_endian(l_len)                                  -- uncompressed size
                                       ,
                                       little_endian(
                          nvl(
                              utl_raw.length(l_name),
                              0
                          ),
                          2
                      )  -- File name length
                      ,
                                       little_endian(
                          nvl(
                              utl_raw.length(l_extra),
                              0
                          ),
                          2
                      ) -- Extra field length
                      ,
                                       utl_raw.concat(l_name                                  -- File name
                                       , l_extra                                 -- extra
                                       )));

        IF l_clen > 0 THEN
            dbms_lob.copy(p_zipped_blob,
                          l_blob,
                          l_clen,
                          dbms_lob.getlength(p_zipped_blob) + 1,
                          1);
        END IF;

        IF dbms_lob.istemporary(l_tmp) = 1 THEN
            dbms_lob.freetemporary(l_tmp);
        END IF;

        IF dbms_lob.istemporary(l_blob) = 1 THEN
            dbms_lob.freetemporary(l_blob);
        END IF;

    END add1file;
  --
    PROCEDURE finish_zip (
        p_zipped_blob IN OUT NOCOPY BLOB,
        p_comment     VARCHAR2 DEFAULT NULL
    ) IS

        l_cnt             INTEGER := 0;
        l_offs            INTEGER;
        l_n               PLS_INTEGER;
        l_m               PLS_INTEGER;
        l_buf             RAW(3999);
        l_compressed_len  INTEGER;
        l_offs_dir_header INTEGER;
        l_offs_end_header INTEGER;
        l_comment         RAW(32767) := utl_raw.cast_to_raw(p_comment);
    BEGIN
        l_offs_dir_header := dbms_lob.getlength(p_zipped_blob);
        IF nvl(l_offs_dir_header, 0) = 0 THEN
            RETURN;
        END IF;
        l_offs := 1;
        LOOP
            l_buf := dbms_lob.substr(p_zipped_blob, 30, l_offs);
            EXIT WHEN nvl(
                utl_raw.length(l_buf),
                0
            ) < 4
            OR c_local_file_header != utl_raw.substr(l_buf, 1, 4);

            l_cnt := l_cnt + 1;
            l_compressed_len := little_endian(l_buf, 19, 4);
            l_n := little_endian(l_buf, 27, 2);
            l_m := little_endian(l_buf, 29, 2);
            dbms_lob.append(p_zipped_blob,
                            utl_raw.concat(c_central_file_header       -- Central directory file header signature
                            ,
                                           c_version,
                                           hextoraw('03')            -- Unix
                                           ,
                                           utl_raw.substr(l_buf, 5),
                                           hextoraw('0000')          -- File comment length
                                           ,
                                           hextoraw('0000')          -- Disk number where file starts
                                           ,
                                           hextoraw('0000')          -- Internal file attributes =>
                                                                   --     0000 binary file
                                                                   --     0100 (ascii)text file
                                           ,
                                           CASE
                                               WHEN l_compressed_len = 0
                                                    AND dbms_lob.substr(p_zipped_blob, 1, l_offs + 30 + l_n - 1) IN(hextoraw('2F') -- /
                                                    , hextoraw('5C') -- \
                                                    ) THEN
                                                   hextoraw('1000ff41') -- a directory/folder
                                               ELSE
                                                   hextoraw('0000ff81') -- a file
                                           END                         -- External file attributes
/*
  wx                r owner
    rw x              group
        rwx fd p      other
            1000 0001 r--------
          1 1000 0001 r-------x
         10 1000 0001 r------w-
        100 1000 0001 r-----r--
       1000 1000 0001 r----x---
*/,
                                           little_endian(l_offs - 1) -- Relative offset of local file header
                                           ,
                                           dbms_lob.substr(p_zipped_blob, l_n + l_m, l_offs + 30)            -- File name + Extra field
                                           ));

            l_offs := l_offs + 30 + l_compressed_len + l_n  -- File name length

             + l_m; -- Extra field length
        END LOOP;

        IF l_offs_dir_header > 0 THEN
            l_offs_end_header := dbms_lob.getlength(p_zipped_blob);
            dbms_lob.append(p_zipped_blob,
                            utl_raw.concat(c_end_of_central_directory                                -- End of central directory signature
                            ,
                                           hextoraw('0000')                                        -- Number of this disk
                                           ,
                                           hextoraw('0000')                                        -- Disk where central directory starts
                                           ,
                                           little_endian(l_cnt, 2)                                 -- Number of central directory records on this disk
                                           ,
                                           little_endian(l_cnt, 2)                                 -- Total number of central directory records
                                           ,
                                           little_endian(l_offs_end_header - l_offs_dir_header)    -- Size of central directory
                                           ,
                                           little_endian(l_offs_dir_header)                        -- Offset of start of central directory, relative to start of archive
                                           ,
                                           little_endian(
                              nvl(
                                  utl_raw.length(l_comment),
                                  0
                              ),
                              2
                          ) -- ZIP file comment length
                          ,
                                           l_comment));

        END IF;

    END finish_zip;
  --
    PROCEDURE save_zip (
        p_zipped_blob BLOB,
        p_dir         VARCHAR2,
        p_filename    VARCHAR2
    ) IS
        l_fh utl_file.file_type;
        l_sz PLS_INTEGER := 32767;
    BEGIN
        l_fh := utl_file.fopen(p_dir, p_filename, 'wb', 32767);
        IF p_zipped_blob IS NOT NULL THEN
            FOR i IN 0..trunc((dbms_lob.getlength(p_zipped_blob) - 1) / l_sz) LOOP
                utl_file.put_raw(l_fh,
                                 dbms_lob.substr(p_zipped_blob, l_sz, i * l_sz + 1),
                                 TRUE);
            END LOOP;

        END IF;

        utl_file.fclose(l_fh);
    END save_zip;
  --
    PROCEDURE delete_file (
        p_zipped_blob IN OUT NOCOPY BLOB,
        p_name        VARCHAR2 CHARACTER SET any_cs := NULL,
        p_idx         NUMBER := NULL,
        p_encoding    VARCHAR2 := NULL
    ) IS

        l_len         INTEGER;
        l_ind         INTEGER;
        l_idx         INTEGER;
        l_nuo_entries INTEGER;
        l_ln          INTEGER;
        l_lm          INTEGER;
        l_sz          INTEGER;
        l_cd_len      INTEGER;
        l_data_len    INTEGER;
        l_buf         RAW(32767);
        l_name        RAW(32767);
        l_utf8_name   RAW(32767);
        l_cd          BLOB;
        l_data        BLOB;
        l_info        tp_zip_info;
        l_cfh         tp_cfh;
    BEGIN
        IF
            p_name IS NULL
            AND p_idx IS NULL
        THEN
            RETURN;
        END IF;
        get_zip_info(p_zipped_blob, l_info, TRUE);
        IF nvl(l_info.cnt, 0) < 1 THEN -- no (zip) file or empty zip file
            RETURN;
        END IF;
    --
        l_cfh.encoding := get_encoding(p_encoding);
    --
        IF p_name IS NOT NULL THEN
            l_name := char2raw(p_name, l_cfh.encoding);
            l_utf8_name := char2raw(p_name, 'AL32UTF8');
        END IF;
    --
        l_ind := l_info.idx_cd;
        l_idx := 1;
        l_nuo_entries := 0;
        l_cd_len := 0;
        l_data_len := 0;
        dbms_lob.createtemporary(l_cd, TRUE, c_lob_duration);
        dbms_lob.createtemporary(l_data, TRUE, c_lob_duration);
        LOOP
            EXIT WHEN NOT parse_central_file_header(p_zipped_blob, l_ind, l_cfh);
            IF l_idx = p_idx
            OR l_cfh.name1 =
                CASE
                    WHEN l_cfh.utf8 THEN
                        l_utf8_name
                    ELSE
                        l_name
                END
            THEN -- skip this file
                NULL;
            ELSE
                IF l_cfh.len > 32767 THEN
                    raise_application_error(-20016, 'Unhandled CD entry');
                END IF;
                l_buf := dbms_lob.substr(p_zipped_blob, 30, l_cfh.offset + 1);
                l_ln := little_endian(l_buf, 27, 2);
                l_lm := little_endian(l_buf, 29, 2);
                l_sz := 30 + l_ln + l_lm + l_cfh.compressed_len;
                IF bitand(TO_NUMBER(utl_raw.substr(l_buf, 7, 1),
       'XX'),
                          8) > 0 THEN
                    l_buf := dbms_lob.substr(p_zipped_blob, 30, l_cfh.offset + 1 + l_sz);

                    IF utl_raw.substr(l_buf, 1, 4) = c_data_descriptor -- optional signature

                     THEN
                        l_sz := l_sz + 4;
                        l_buf := utl_raw.substr(l_buf, 5);
                    END IF;

                    IF utl_raw.substr(l_buf, 13, 4) IN ( c_local_file_header, c_central_file_header ) THEN
                        l_sz := l_sz + 12;
                    ELSIF utl_raw.substr(l_buf, 21, 4) IN ( c_local_file_header, c_central_file_header ) THEN  -- zip64 sizes
                        l_sz := l_sz + 20;
                    ELSE
                        raise_application_error(-20017, 'Error parsing the zipfile');
                    END IF;

                END IF;
        --
                l_nuo_entries := l_nuo_entries + 1;
                dbms_lob.copy(l_data, p_zipped_blob, l_sz, l_data_len + 1, l_cfh.offset + 1);

                l_buf := dbms_lob.substr(p_zipped_blob, l_cfh.len, l_ind);
                IF utl_raw.substr(l_buf, 43, 4) = hextoraw('FFFFFFFF') THEN
                    l_buf := utl_raw.overlay(
                        little_endian(l_data_len, 8),
                        l_buf,
                        l_cfh.zip64_offset,
                        8
                    );
                ELSE
                    l_buf := utl_raw.overlay(
                        little_endian(l_data_len),
                        l_buf,
                        43,
                        4
                    );
                END IF;

                dbms_lob.writeappend(l_cd,
                                     utl_raw.length(l_buf),
                                     l_buf);
        --
                l_data_len := l_data_len + l_sz;
                l_cd_len := l_cd_len + l_cfh.len;
            END IF;

            l_ind := l_ind + l_cfh.len;
            l_idx := l_idx + 1;
        END LOOP;
    --
        IF l_nuo_entries = l_info.cnt THEN
            dbms_lob.freetemporary(l_data);
            dbms_lob.freetemporary(l_cd);
            RETURN;
        END IF;
    --
        dbms_lob.trim(p_zipped_blob, 0);
        IF l_nuo_entries > 0 THEN
            dbms_lob.append(p_zipped_blob, l_data);
            dbms_lob.append(p_zipped_blob, l_cd);
        END IF;

        write_eocd(p_zipped_blob, l_info.zip64, l_nuo_entries, l_cd_len, l_data_len,
                   l_info);
        dbms_lob.freetemporary(l_data);
        dbms_lob.freetemporary(l_cd);
    END delete_file;
  --
    PROCEDURE add_file (
        p_zipped_blob  IN OUT NOCOPY BLOB,
        p_name         VARCHAR2 CHARACTER SET any_cs,
        p_content      BLOB := NULL,
        p_comment      VARCHAR2 CHARACTER SET any_cs := NULL,
        p_password     VARCHAR2 := NULL,
        p_date         DATE := NULL,
        p_zipcrypto    BOOLEAN := NULL,
        p_is_directory BOOLEAN := NULL
    ) IS

        l_offs_lfh       INTEGER;
        l_offs_cd        INTEGER;
        l_len_cd         INTEGER;
        l_compressed_len INTEGER;
        l_n              PLS_INTEGER;
        l_m              PLS_INTEGER;
        l_k              PLS_INTEGER := 0;
        l_buf            RAW(32767);
        l_cd             BLOB;
        l_data           BLOB;
        l_comment        RAW(32767);
        l_info           tp_zip_info;
    BEGIN
        IF p_zipped_blob IS NULL THEN
            p_zipped_blob := hextoraw('504B0506000000000000000000000000000000000000');
        END IF;
        get_zip_info(p_zipped_blob, l_info, TRUE);
        l_offs_lfh := l_info.idx_cd - 1;
    --
        IF l_info.idx_cd >= 4294967295 -- FFFFFFFF
        OR dbms_lob.getlength(p_content) >= 4294967295 THEN
            raise_application_error(-20020, 'Zip64 not yet handled');
        END IF;

        dbms_lob.createtemporary(l_cd, TRUE, c_lob_duration);
        dbms_lob.copy(l_cd, p_zipped_blob, dbms_lob.lobmaxsize, 1, l_info.idx_cd);

        dbms_lob.trim(p_zipped_blob, l_info.idx_cd - 1);
        add1file(l_data, p_name,
                 CASE
                     WHEN p_is_directory THEN
                         NULL
                     ELSE
                         p_content
                 END, p_password, p_date,
                 p_zipcrypto);

        dbms_lob.append(p_zipped_blob, l_data);
        l_offs_cd := l_offs_lfh + dbms_lob.getlength(l_data);
    --
        IF l_info.len_cd > 0 THEN -- add old Central Directory again
            IF l_info.len_cd < 32767 THEN
                dbms_lob.writeappend(p_zipped_blob,
                                     l_info.len_cd,
                                     dbms_lob.substr(l_cd, l_info.len_cd, 1));

            ELSE
                dbms_lob.copy(p_zipped_blob, l_cd, l_info.len_cd, l_offs_cd + 1, 1);
            END IF;
        END IF;
    -- add new entry to Central Directory
        l_buf := dbms_lob.substr(l_data, 32767, 1);
        l_compressed_len := little_endian(l_buf, 19, 4);
        l_n := little_endian(l_buf, 27, 2);
        l_m := little_endian(l_buf, 29, 2);
        IF p_comment IS NOT NULL THEN
            BEGIN
                l_comment := char2raw(p_comment, 'AL32UTF8');
                l_k := utl_raw.length(l_comment);
            EXCEPTION
                WHEN OTHERS THEN
                    l_comment := NULL;
                    l_k := 0;
            END;
        END IF;

        l_len_cd := l_info.len_cd + 46 + l_n + l_m + l_k;
        dbms_lob.writeappend(p_zipped_blob,
                             46,
                             utl_raw.concat(c_central_file_header       -- Central directory file header signature
                             ,
                                            c_version,
                                            hextoraw('03')            -- Unix
                                            ,
                                            utl_raw.substr(l_buf, 5, 26),
                                            little_endian(l_k, 2)     -- File comment length
                                            ,
                                            hextoraw('0000')          -- Disk number where file starts
                                            ,
                                            hextoraw('0000')          -- Internal file attributes =>
                                                    --     0000 binary file
                                                    --     0100 (ascii)text file
                                            ,
                                            CASE
                                                WHEN p_is_directory
                                                     OR(l_compressed_len = 0
                                                        AND substr(p_name, -1) IN('/', '\')) THEN
                                                    hextoraw('1000ff41') -- a directory/folder
                                                ELSE
                                                    hextoraw('0000ff81') -- a file
                                            END                           -- External file attributes
                                            ,
                                            little_endian(l_offs_lfh)   -- Relative offset of local file header
                                            ));

        IF l_n + l_m + l_k < 32767 THEN
            dbms_lob.writeappend(p_zipped_blob,
                                 l_n + l_m + l_k,
                                 utl_raw.concat(
                            utl_raw.substr(l_buf, 31, l_n + l_m)  -- File name + Extra field
                            ,
                            l_comment
                        ));
        ELSE
            dbms_lob.copy(p_zipped_blob, l_data, l_n + l_m, l_offs_cd + l_info.len_cd + 46 + 1, 31);

            IF l_k > 0 THEN
                dbms_lob.writeappend(p_zipped_blob, l_k, l_comment);
            END IF;

        END IF;
    --
        write_eocd(p_zipped_blob, l_info.zip64, l_info.cnt + 1, l_len_cd, l_offs_cd,
                   l_info);
    --
        dbms_lob.freetemporary(l_data);
        dbms_lob.freetemporary(l_cd);
    END add_file;
  --
    FUNCTION get_count (
        p_zipped_blob BLOB
    ) RETURN INTEGER IS
        l_info tp_zip_info;
    BEGIN
        get_zip_info(p_zipped_blob, l_info);
        RETURN nvl(l_info.cnt, 0);
    END;
  --
    FUNCTION get_comment (
        p_zipped_blob BLOB
    ) RETURN CLOB IS
        l_info tp_zip_info;
    BEGIN
        get_zip_info(p_zipped_blob, l_info, TRUE);
        RETURN get_64k_raw(l_info.comment1, l_info.comment2, l_info.comment3);
    END;
  --
    PROCEDURE set_comment (
        p_zipped_blob IN OUT NOCOPY BLOB,
        p_comment     VARCHAR2 CHARACTER SET any_cs := NULL
    ) IS
        l_info    tp_zip_info;
        l_len     PLS_INTEGER;
        l_comment RAW(32767);
    BEGIN
        IF p_zipped_blob IS NULL THEN
            p_zipped_blob := hextoraw('504B0506000000000000000000000000000000000000');
        END IF;
        get_zip_info(p_zipped_blob, l_info);
        IF p_comment IS NULL THEN
            l_len := 0;
        ELSE
            l_comment := char2raw(p_comment, 'AL32UTF8');
            l_len := utl_raw.length(l_comment);
        END IF;

        dbms_lob.trim(p_zipped_blob, l_info.idx_eocd + 19);
        dbms_lob.writeappend(p_zipped_blob,
                             l_len + 2,
                             utl_raw.concat(
                        little_endian(l_len, 2),
                        l_comment
                    ));

    END set_comment;
  --
    FUNCTION get_file_info (
        p_zipped_blob BLOB,
        p_file_info   IN OUT file_info,
        p_name        VARCHAR2 CHARACTER SET any_cs := NULL,
        p_idx         NUMBER := NULL,
        p_encoding    VARCHAR2 := NULL
    ) RETURN BOOLEAN IS
        l_cfh tp_cfh;
    BEGIN
        p_file_info := NULL;
        p_file_info.found := get_central_file_header(p_zipped_blob, p_name, p_idx, p_encoding, l_cfh);
        IF p_file_info.found THEN
            p_file_info.found := TRUE;
            p_file_info.is_encrypted := l_cfh.encrypted;
            p_file_info.is_directory :=
                l_cfh.original_len = 0
                AND utl_raw.substr(l_cfh.external_file_attr, 1, 2) = '1000';

            p_file_info.idx := l_cfh.idx;
            p_file_info.len := l_cfh.original_len;
            p_file_info.clen := l_cfh.compressed_len;
            p_file_info.name := get_64k_raw(l_cfh.name1, l_cfh.name2, l_cfh.name3,
                                            CASE
                                                WHEN l_cfh.utf8 THEN
                                                    'AL32UTF8'
                                                ELSE
                                                    l_cfh.encoding
                                            END
            );

            p_file_info.comment := get_64k_raw(l_cfh.comment1, l_cfh.comment2, l_cfh.comment3,
                                               CASE
                                                   WHEN l_cfh.utf8 THEN
                                                       'AL32UTF8'
                                               END
            );

            p_file_info.nname := utl_i18n.raw_to_nchar(l_cfh.name1,
                                                       CASE
                                                           WHEN l_cfh.utf8 THEN
                                                               'AL32UTF8'
                                                           ELSE
                                                               l_cfh.encoding
                                                       END
            );

        END IF;
    --
        RETURN p_file_info.found;
    END get_file_info;
  --
    FUNCTION get_file_info (
        p_zipped_blob BLOB,
        p_name        VARCHAR2 CHARACTER SET any_cs := NULL,
        p_idx         NUMBER := NULL,
        p_encoding    VARCHAR2 := NULL
    ) RETURN file_info IS
        l_dummy     BOOLEAN;
        l_file_info file_info;
    BEGIN
        l_dummy := get_file_info(p_zipped_blob, l_file_info, p_name, p_idx, p_encoding);
        RETURN l_file_info;
    END get_file_info;
  --
    PROCEDURE add_clob (
        p_zipped_blob IN OUT NOCOPY BLOB,
        p_name        VARCHAR2 CHARACTER SET any_cs,
        p_content     CLOB CHARACTER SET any_cs,
        p_comment     VARCHAR2 CHARACTER SET any_cs := NULL,
        p_password    VARCHAR2 := NULL,
        p_date        DATE := NULL,
        p_encoding    VARCHAR2 := NULL,
        p_zipcrypto   BOOLEAN := NULL
    ) IS

        l_blob        BLOB;
        l_dest_offset INTEGER := 1;
        l_src_offset  INTEGER := 1;
        l_context     INTEGER := dbms_lob.default_lang_ctx;
        l_warning     INTEGER;
        l_csid        INTEGER := coalesce(
            nls_charset_id(p_encoding),
            dbms_lob.default_csid
        );
    BEGIN
        dbms_lob.createtemporary(l_blob, TRUE, c_lob_duration);
        IF p_content IS NOT NULL THEN
            dbms_lob.converttoblob(l_blob, p_content, dbms_lob.lobmaxsize, l_dest_offset, l_src_offset,
                                   l_csid, l_context, l_warning);

        END IF;
    --
        add_file(p_zipped_blob, p_name, l_blob, p_comment, p_password,
                 p_date, p_zipcrypto);
    --
        dbms_lob.freetemporary(l_blob);
    EXCEPTION
        WHEN OTHERS THEN
            IF dbms_lob.istemporary(l_blob) = 1 THEN
                dbms_lob.freetemporary(l_blob);
            END IF;

            RAISE;
    END add_clob;
  --
    PROCEDURE add_csv (
        p_zipped_blob    IN OUT NOCOPY BLOB,
        p_cursor         IN OUT SYS_REFCURSOR,
        p_name           VARCHAR2 CHARACTER SET any_cs,
        p_comment        VARCHAR2 CHARACTER SET any_cs := NULL,
        p_password       VARCHAR2 := NULL,
        p_date           DATE := NULL,
        p_separator      VARCHAR2 := ',',
        p_enclosed_by    VARCHAR2 := '"',
        p_newline        VARCHAR2 := NULL,
        p_column_headers BOOLEAN := NULL,
        p_bulk_size      PLS_INTEGER := NULL,
        p_encoding       VARCHAR2 := NULL,
        p_zipcrypto      BOOLEAN := NULL
    ) IS

        l_c         INTEGER;
        l_csv       CLOB;
        l_col_cnt   INTEGER;
        l_desc_tab  dbms_sql.desc_tab2;
        l_v         VARCHAR2(32767);
        l_clob      CLOB;
        l_first     PLS_INTEGER;
        l_r         INTEGER;
        l_cnt       PLS_INTEGER;
        c_separator CONSTANT VARCHAR2(100) := nvl(
            substr(p_separator, 1, 100),
            ','
        );
        c_newline   CONSTANT VARCHAR2(10) := nvl(p_newline,
                                               chr(13)
                                               || chr(10));
        l_last_col  PLS_INTEGER;
    --
        PROCEDURE append (
            p_val VARCHAR2,
            p_sep BOOLEAN
        ) IS
        BEGIN
            IF p_enclosed_by IS NULL THEN
                l_csv := l_csv
                         || ( p_val ||
                    CASE
                        WHEN p_sep THEN
                            c_separator
                        ELSE
                            c_newline
                    END
                );

            ELSE
                l_csv := l_csv
                         || ( p_enclosed_by
                              || replace(p_val, p_enclosed_by, p_enclosed_by || p_enclosed_by)
                              || p_enclosed_by ||
                    CASE
                        WHEN p_sep THEN
                            c_separator
                        ELSE
                            c_newline
                    END
                );
            END IF;
        END;
    --
        PROCEDURE append_clob (
            p_val CLOB,
            p_sep BOOLEAN
        ) IS
        BEGIN
            IF p_enclosed_by IS NULL THEN
                l_csv := l_csv
                         || ( p_val ||
                    CASE
                        WHEN p_sep THEN
                            c_separator
                        ELSE
                            c_newline
                    END
                );

            ELSE
                l_csv := l_csv
                         || ( p_enclosed_by
                              || replace(p_val, p_enclosed_by, p_enclosed_by || p_enclosed_by)
                              || p_enclosed_by ||
                    CASE
                        WHEN p_sep THEN
                            c_separator
                        ELSE
                            c_newline
                    END
                );
            END IF;
        END;

    BEGIN
        l_c := dbms_sql.to_cursor_number(p_cursor);
        dbms_lob.createtemporary(l_csv, TRUE, c_lob_duration);
        dbms_sql.describe_columns2(l_c, l_col_cnt, l_desc_tab);
        FOR c IN 1..l_col_cnt LOOP
            IF l_desc_tab(c).col_type IN ( 2, 100, 101, 12, 180,
                                           181, 231, 1, 9, 96,
                                           112, 182, 183 ) THEN
                l_last_col := c;
            END IF;
        END LOOP;

        FOR c IN 1..l_col_cnt LOOP
            IF (
                p_column_headers
                AND l_desc_tab(c).col_type IN ( 2   -- number
                , 100 -- bfloat
                , 101 -- bdouble
                , 12  -- date
                , 180 -- timestamp
                ,
                                                181 -- timestamp with timezone
                                                , 231 -- timestamp with local timezone
                                                , 1   -- varchar
                                                , 9   -- varchar2
                                                , 96  -- char
--                                         , 8   -- long
                                                ,
                                                112 -- clob
                                                , 182 -- interval year to month
                                                , 183 -- interval day to second
                                                 )
            ) THEN
                append(l_desc_tab(c).col_name,
                       c < l_last_col);
            END IF;

            CASE
                WHEN l_desc_tab(c).col_type IN ( 2, 100, 101, 12, 180,
                                                 181, 231, 1, 9, 96,
                                                 182, 183 ) THEN
                    dbms_sql.define_column(l_c, c, l_v, 32767);
                WHEN l_desc_tab(c).col_type IN ( 112 ) THEN
                    dbms_sql.define_column(l_c, c, l_clob);
                ELSE
                    NULL;
            END CASE;

        END LOOP;
    --
        l_cnt := 0;
        LOOP
            EXIT WHEN dbms_sql.fetch_rows(l_c) = 0;
            l_cnt := l_cnt + l_r;
            FOR c IN 1..l_col_cnt LOOP
                CASE
                    WHEN l_desc_tab(c).col_type IN ( 2, 100, 101, 12, 180,
                                                     181, 231, 1, 9, 96,
                                                     182, 183 ) THEN
                        dbms_sql.column_value(l_c, c, l_v);
                        append(l_v, c < l_last_col);
                    WHEN l_desc_tab(c).col_type IN ( 112 ) THEN
                        dbms_sql.column_value(l_c, c, l_clob);
                        append_clob(l_clob, c < l_last_col);
                    ELSE
                        NULL;
                END CASE;
            END LOOP;

        END LOOP;

        dbms_sql.close_cursor(l_c);
        IF dbms_lob.istemporary(l_clob) = 1 THEN
            dbms_lob.freetemporary(l_clob);
        END IF;
    --
        add_clob(p_zipped_blob, p_name, l_csv, p_comment, p_password,
                 p_date, p_encoding, p_zipcrypto);
    --
        dbms_lob.freetemporary(l_csv);
    EXCEPTION
        WHEN OTHERS THEN
            IF dbms_sql.is_open(l_c) THEN
                dbms_sql.close_cursor(l_c);
            END IF;
            IF dbms_lob.istemporary(l_csv) = 1 THEN
                dbms_lob.freetemporary(l_csv);
            END IF;

            RAISE;
    END add_csv;
  --
  --
  --

    PROCEDURE add (
        p_zip      IN OUT NOCOPY BLOB,
        p_name     VARCHAR2 CHARACTER SET any_cs,
        p_content  BLOB,
        p_password VARCHAR2 DEFAULT NULL,
        p_comment  VARCHAR2 CHARACTER SET any_cs DEFAULT NULL
    ) AS
    BEGIN
        add_file(p_zip, p_name, p_content, p_comment, p_password,
                 NULL,
                 CASE
                     WHEN p_password IS NOT NULL THEN
                         TRUE
                     ELSE
                         NULL
                 END,
                 CASE
                     WHEN p_content IS NULL THEN
                         TRUE
                     ELSE
                         NULL
                 END
        );
    END;

    PROCEDURE extract (
        p_zip      IN OUT NOCOPY BLOB,
        p_name     VARCHAR2 CHARACTER SET any_cs,
        r_content  OUT BLOB,
        p_password VARCHAR2 DEFAULT NULL
    ) AS
    BEGIN
        r_content := get_file(p_zip, p_name, NULL, NULL, p_password);
    END;

    PROCEDURE remove (
        p_zip  IN OUT NOCOPY BLOB,
        p_name VARCHAR2 CHARACTER SET any_cs
    ) AS
    BEGIN
        delete_file(p_zip, p_name);
    END;

    FUNCTION list (
        p_zip    BLOB,
        p_search VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 100,
        p_offset PLS_INTEGER DEFAULT 0
    ) RETURN t_file_list AS
        fl  file_list;
        tfl t_file_list := t_file_list();
    BEGIN
        fl := get_file_list(p_zip, NULL, p_offset, p_limit, p_search,
                            NULL);
        FOR i IN 1..fl.count LOOP
            tfl.extend;
            tfl(tfl.count) := fl(i);
        END LOOP;

        RETURN tfl;
    END;

    PROCEDURE details (
        p_zip             BLOB,
        p_name            VARCHAR2 CHARACTER SET any_cs,
        r_size            OUT PLS_INTEGER,
        r_compressed_size OUT PLS_INTEGER,
        r_is_directory    OUT BOOLEAN,
        r_has_password    OUT BOOLEAN,
        r_comment         OUT VARCHAR2
    ) AS
        fi file_info;
    BEGIN
        fi := get_file_info(p_zip, p_name);
        r_size := fi.len;
        r_compressed_size := fi.clen;
        r_is_directory := fi.is_directory;
        r_has_password := fi.is_encrypted;
        r_comment := fi.comment;
    END;

END;
/


-- sqlcl_snapshot {"hash":"5d474760eaf28afc70147389944722b2f8eab921","type":"PACKAGE_BODY","name":"PCK_API_ZIP","schemaName":"ODBVUE","sxml":""}
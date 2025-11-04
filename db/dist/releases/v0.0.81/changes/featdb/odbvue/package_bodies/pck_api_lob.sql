-- liquibase formatted sql
-- changeset ODBVUE:1762266057875a stripComments:false  logicalFilePath:featdb\odbvue\package_bodies\pck_api_lob.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_lob.sql:null:1e64084792043ed4a94fcb64df9152f7c7a6c27e:create

create or replace package body odbvue.pck_api_lob as

  -- PRIVATE

    c_crlf              constant varchar2(2) := chr(13)
                                   || chr(10);
    c_whitespace        constant varchar2(6) := ' '
                                         || chr(13)
                                         || chr(10)
                                         || chr(9)
                                         || chr(11)
                                         || chr(12);
    c_max_enc_chunk_len constant pls_integer := 23760;
    c_max_dec_chunk_len constant pls_integer := 31680;

    function remove_whitespace (
        p_varchar2 varchar2
    ) return varchar2 as
    begin
        return translate(p_varchar2, 'a' || c_whitespace, 'a');
    end;

    function decode_raw (
        p_varchar2          varchar2,
        p_remove_whitespace boolean default 1
    ) return raw as
    begin
        return
            case
                when p_varchar2 is not null then
                    utl_encode.base64_decode(utl_raw.cast_to_raw(
                        case
                            when p_remove_whitespace = 0 then
                                p_varchar2
                            else
                                remove_whitespace(p_varchar2)
                        end
                    ))
            end;
    end;

  -- PUBLIC

    function clob_to_blob (
        p_clob             clob,
        p_charset_id       integer default dbms_lob.default_csid,
        p_error_on_warning boolean default 0
    ) return blob as

        v_result       blob;
        v_dest_offset  integer := 1;
        v_src_offset   integer := 1;
        v_lang_context integer := dbms_lob.default_lang_ctx;
        v_warning      integer;
    begin
        dbms_lob.createtemporary(v_result, true, dbms_lob.call);
        dbms_lob.converttoblob(
            dest_lob     => v_result,
            src_clob     => p_clob,
            amount       => dbms_lob.lobmaxsize,
            dest_offset  => v_dest_offset,
            src_offset   => v_src_offset,
            blob_csid    => p_charset_id,
            lang_context => v_lang_context,
            warning      => v_warning
        );

        if
            v_warning <> dbms_lob.no_warning
            and p_error_on_warning = 1
        then
            raise_application_error(-20001, 'Error during lob conversion : '
                                            ||
                case
                    when v_warning = dbms_lob.warn_inconvertible_char then
                        'Inconvertible character'
                    else
                        'Warning code ' || v_warning
                end
            );
        end if;

        return v_result;
    end;

    function blob_to_clob (
        p_blob             blob,
        p_charset_id       integer default dbms_lob.default_csid,
        p_error_on_warning boolean default 0
    ) return clob as

        v_result       clob;
        v_dest_offset  integer := 1;
        v_src_offset   integer := 1;
        v_lang_context integer := dbms_lob.default_lang_ctx;
        v_warning      integer;
    begin
        dbms_lob.createtemporary(v_result, true, dbms_lob.call);
        dbms_lob.converttoclob(
            dest_lob     => v_result,
            src_blob     => p_blob,
            amount       => dbms_lob.lobmaxsize,
            dest_offset  => v_dest_offset,
            src_offset   => v_src_offset,
            blob_csid    => p_charset_id,
            lang_context => v_lang_context,
            warning      => v_warning
        );

        if
            v_warning <> dbms_lob.no_warning
            and p_error_on_warning = 1
        then
            raise_application_error(-20001, 'Error during lob conversion : '
                                            ||
                case
                    when v_warning = dbms_lob.warn_inconvertible_char then
                        'Inconvertible character'
                    else
                        'Warning code ' || v_warning
                end
            );
        end if;

        return v_result;
    end;

    function encode_raw (
        p_raw     raw,
        p_newline boolean default 1
    ) return varchar2 as
    begin
        return
            case
                when p_raw is null then
                    null
                when p_newline = 0 then
                    replace(
                        utl_raw.cast_to_varchar2(utl_encode.base64_encode(p_raw)),
                        c_crlf,
                        ''
                    )
                else
                    rtrim(
                        utl_raw.cast_to_varchar2(utl_encode.base64_encode(p_raw)),
                        c_crlf
                    )
            end;
    end;

    function blob_to_base64 (
        p_blob    blob,
        p_newline boolean default 1
    ) return clob as

        v_length pls_integer := coalesce(
            dbms_lob.getlength(p_blob),
            0
        );
        v_offset pls_integer := 1;
        v_chunk  varchar2(32767);
        v_crlf   varchar2(2) :=
            case
                when p_newline = 0 then
                    null
                else
                    c_crlf
            end;
        v_result clob;
    begin
        case
            when v_length = 0 then
                v_result :=
                    case
                        when p_blob is null then
                            null
                        else
                            empty_clob()
                    end;
            when v_length <= c_max_enc_chunk_len then
                v_result := encode_raw(p_blob, p_newline);
            else
                dbms_lob.createtemporary(v_result, true, dbms_lob.call);
                for i in 1..ceil(v_length / c_max_enc_chunk_len) loop
                    v_chunk :=
                        case
                            when i > 1 then
                                v_crlf
                        end
                        || encode_raw(
                        dbms_lob.substr(p_blob, c_max_enc_chunk_len, v_offset),
                        p_newline
                    );

                    dbms_lob.writeappend(v_result,
                                         length(v_chunk),
                                         v_chunk);
                    v_offset := v_offset + c_max_enc_chunk_len;
                end loop;

        end case;

        return v_result;
    end;

    function clob_to_base64 (
        p_clob    clob,
        p_newline boolean default 1
    ) return clob as
    begin
        return
            case
                when p_clob is null
                     or p_clob = empty_clob() then
                    p_clob
                else
                    blob_to_base64(
                        clob_to_blob(p_clob),
                        p_newline
                    )
            end;
    end;

    function varchar2_to_base64 (
        p_varchar2 varchar2,
        p_newline  boolean default 1
    ) return clob as
    begin
        return encode_raw(
            utl_raw.cast_to_raw(p_varchar2),
            p_newline
        );
    end;

    function base64_to_blob (
        p_base64 clob
    ) return blob as

        v_offset        integer := 1;
        v_length        pls_integer := coalesce(
            dbms_lob.getlength(p_base64),
            0
        );
        v_buffer        varchar2(32767);
        v_modulo        pls_integer;
        v_overflow      varchar2(4);
        v_buffer_length pls_integer;
        v_amount        integer := c_max_dec_chunk_len;
        v_result        blob;

        procedure append_chunk (
            p_chunk varchar2
        ) as
            v_buffer_raw raw(32767);
        begin
            v_buffer_raw := decode_raw(p_chunk,
                                       p_remove_whitespace => 0);
            dbms_lob.writeappend(v_result,
                                 utl_raw.length(v_buffer_raw),
                                 v_buffer_raw);
        end;

    begin
        case
            when v_length = 0 then
                v_result :=
                    case
                        when p_base64 is null then
                            null
                        else
                            empty_blob()
                    end;
            when v_length <= c_max_dec_chunk_len then
                v_result := decode_raw(p_base64);
            when v_length > c_max_dec_chunk_len then
                dbms_lob.createtemporary(v_result, false, dbms_lob.call);
                while v_offset <= v_length loop
                    dbms_lob.read(p_base64, v_amount, v_offset, v_buffer);
                    v_buffer := remove_whitespace(v_buffer);
                    v_buffer_length := length(v_buffer);
                    v_modulo := mod(v_buffer_length, 4);
                    if v_modulo > 0 then
                        append_chunk(v_overflow || substr(v_buffer, 1, v_buffer_length - v_modulo));
                        v_overflow := substr(v_buffer, -v_modulo);
                    else
                        append_chunk(v_buffer);
                        v_overflow := null;
                    end if;

                    v_offset := v_offset + v_amount;
                end loop;

                if v_overflow is not null then
                    append_chunk(v_overflow);
                end if;
        end case;

        return v_result;
    end;

    function base64_to_clob (
        p_base64 clob
    ) return clob as
        v_length pls_integer := coalesce(
            dbms_lob.getlength(p_base64),
            0
        );
    begin
        return
            case
                when v_length = 0                    then
                    p_base64
                when v_length <= c_max_dec_chunk_len then
                    base64_to_varchar2(p_base64)
                when v_length > c_max_dec_chunk_len  then
                    blob_to_clob(base64_to_blob(p_base64))
            end;
    end;

    function base64_to_varchar2 (
        p_base64 clob
    ) return varchar2 as
    begin
        return utl_raw.cast_to_varchar2(decode_raw(p_base64));
    end;

end;
/


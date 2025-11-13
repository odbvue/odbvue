CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_openai AS 
  -- PRIVATE
  
  -- PRIVATE
    FUNCTION j (
        p_string CLOB
    ) RETURN CLOB AS
        l_clob CLOB;
    BEGIN
        IF p_string IS NULL THEN
            RETURN NULL;
        END IF;

  -- remove CR/LF and collapse double spaces
        l_clob := replace(
            replace(
                replace(p_string,
                        chr(10),
                        ' '),
                chr(13),
                ' '
            ),
            '  ',
            ' '
        );

        RETURN l_clob;
    END j;

    FUNCTION input (
        p_model   VARCHAR2,
        p_input   VARCHAR2,
        p_options CLOB
    ) RETURN CLOB AS
        v_payload json_object_t;
    BEGIN
  -- start from options if provided, otherwise empty object
        IF p_options IS NOT NULL THEN
            v_payload := json_object_t.parse(p_options);
        ELSE
            v_payload := json_object_t();
        END IF;

        v_payload.put('model', p_model);
        v_payload.put('input', p_input);
        RETURN v_payload.to_clob();
    END input;

-- PUBLIC
    PROCEDURE responses (
        p_api_key VARCHAR2,
        p_model   VARCHAR2,
        p_input   VARCHAR2,
        p_options CLOB DEFAULT NULL,
        r_output  OUT CLOB,
        r_error   OUT VARCHAR2
    ) AS
        v_req      utl_http.req;
        v_payload  CLOB;
        v_messages CLOB;
    BEGIN
        r_error := NULL;
        r_output := NULL;
        v_payload := input(p_model, p_input, p_options);
        pck_api_http.request(v_req, 'POST', 'https://api.openai.com/v1/responses');
        pck_api_http.request_auth_token(v_req, p_api_key);
        pck_api_http.request_content_type(v_req, 'application/json');
        pck_api_http.request_charset(v_req, 'UTF-8');
        pck_api_http.request_json(v_req, v_payload);
        pck_api_http.response_text(v_req, v_messages);
        r_error := JSON_VALUE(v_messages, '$.error.message');
        IF r_error IS NOT NULL THEN
            RETURN;
        END IF;
        SELECT
            JSON_VALUE(v_messages, '$.output[1].content[0].text')
        INTO r_output
        FROM
            dual;

    END responses;

    PROCEDURE speech (
        p_api_key         VARCHAR2,
        p_model           VARCHAR2,
        p_input           VARCHAR2,
        p_voice           VARCHAR2,
        p_response_format VARCHAR2,
        p_speed           FLOAT,
        r_speech          OUT BLOB,
        r_error           OUT VARCHAR2
    ) AS
        v_payload CLOB;
        v_req     utl_http.req;
        v_blob    BLOB;
        v_clob    CLOB;
    BEGIN
        r_error := NULL;
        v_payload := '{'
                     || '"model": "'
                     || p_model
                     || '"'
                     || ', "input": "'
                     || j(p_input)
                     || '"'
                     || ', "voice": "'
                     || p_voice
                     || '"'
                     || ', "response_format": "'
                     || p_response_format
                     || '"'
                     || ', "speed": "'
                     || p_speed
                     || '"'
                     || '}';

        pck_api_http.request(v_req, 'POST', 'https://api.openai.com/v1/audio/speech');
        pck_api_http.request_auth_token(v_req, p_api_key);
        pck_api_http.request_content_type(v_req, 'application/json');
        pck_api_http.request_charset(v_req, 'UTF-8');
        pck_api_http.request_json(v_req, v_payload);
        pck_api_http.response_binary(v_req, v_blob);
        v_clob := pck_api_lob.blob_to_clob(v_blob);
        r_error := JSON_VALUE(v_clob, '$.error.message');
        IF r_error IS NOT NULL THEN
            RETURN;
        END IF;
        r_speech := v_blob;
    END;

    PROCEDURE speech (
        p_api_key VARCHAR2,
        p_input   VARCHAR2,
        r_speech  OUT BLOB,
        r_error   OUT VARCHAR2
    ) AS
    BEGIN
        speech(p_api_key, 'tts-1', -- model
         p_input, 'alloy', -- voice
         'mp3', --format
               1, -- speed 
                r_speech, r_error);
    END;

    PROCEDURE transcript (
        p_api_key         VARCHAR2,
        p_file            BLOB,
        p_filename        VARCHAR2,
        p_model           VARCHAR2,
        p_language        VARCHAR2,
        p_prompt          VARCHAR2,
        p_response_format VARCHAR2,
        p_temperature     VARCHAR2,
        r_transcript      OUT VARCHAR2,
        r_error           OUT VARCHAR2
    ) AS
        v_req      utl_http.req;
        v_response VARCHAR2(32767);
    BEGIN
        r_error := NULL;
        pck_api_http.request(v_req, 'POST', 'https://api.openai.com/v1/audio/transcriptions');
        pck_api_http.request_auth_token(v_req, p_api_key);
        pck_api_http.request_multipart_start(v_req);
        pck_api_http.request_multipart_varchar2(v_req, 'model', p_model);
        pck_api_http.request_multipart_varchar2(v_req, 'language', p_language);
        pck_api_http.request_multipart_varchar2(v_req, 'prompt', p_prompt);
        pck_api_http.request_multipart_varchar2(v_req, 'response_format', p_response_format);
        pck_api_http.request_multipart_varchar2(v_req, 'temperature', p_temperature);
        pck_api_http.request_multipart_blob(v_req, 'file', p_filename, p_file);
        pck_api_http.request_multipart_end(v_req);
        pck_api_http.response_text(v_req, v_response);
        r_error := JSON_VALUE(v_response, '$.error.message');
        IF r_error IS NOT NULL THEN
            RETURN;
        END IF;
        r_transcript := v_response;
    END;

    PROCEDURE translations (
        p_api_key         VARCHAR2,
        p_file            BLOB,
        p_filename        VARCHAR2,
        p_model           VARCHAR2,
        p_language        VARCHAR2,
        p_prompt          VARCHAR2,
        p_response_format VARCHAR2,
        p_temperature     VARCHAR2,
        r_transcript      OUT VARCHAR2,
        r_error           OUT VARCHAR2
    ) AS
        v_req      utl_http.req;
        v_response VARCHAR2(32767);
    BEGIN
        r_error := NULL;
        pck_api_http.request(v_req, 'POST', 'https://api.openai.com/v1/audio/translations');
        pck_api_http.request_auth_token(v_req, p_api_key);
        pck_api_http.request_multipart_start(v_req);
        pck_api_http.request_multipart_varchar2(v_req, 'model', p_model);
        pck_api_http.request_multipart_varchar2(v_req, 'language', p_language);
        pck_api_http.request_multipart_varchar2(v_req, 'prompt', p_prompt);
        pck_api_http.request_multipart_varchar2(v_req, 'response_format', p_response_format);
        pck_api_http.request_multipart_varchar2(v_req, 'temperature', p_temperature);
        pck_api_http.request_multipart_blob(v_req, 'file', p_filename, p_file);
        pck_api_http.request_multipart_end(v_req);
        pck_api_http.response_text(v_req, v_response);
        r_error := JSON_VALUE(v_response, '$.error.message');
        IF r_error IS NOT NULL THEN
            RETURN;
        END IF;
        r_transcript := v_response;
    END;

    PROCEDURE completion (
        p_api_key VARCHAR2,
        p_model   VARCHAR2,
        p_prompt  VARCHAR2,
        p_message CLOB,
        r_message OUT CLOB,
        r_error   OUT VARCHAR2
    ) AS
        v_payload  CLOB;
        v_messages CLOB;
        v_req      utl_http.req;
    BEGIN
        r_error := NULL;
        v_payload := '{
      "model": "'
                     || p_model
                     || '",
      "messages": [
        {"role": "system","content": "'
                     || j(p_prompt)
                     || '"},
        {"role": "user","content": "'
                     || j(p_message)
                     || '"}
      ]
    }';

        pck_api_http.request(v_req, 'POST', 'https://api.openai.com/v1/chat/completions');
        pck_api_http.request_auth_token(v_req, p_api_key);
        pck_api_http.request_content_type(v_req, 'application/json');
        pck_api_http.request_charset(v_req, 'UTF-8');
        pck_api_http.request_json(v_req, v_payload);
        pck_api_http.response_text(v_req, v_messages);
        r_error := JSON_VALUE(v_messages, '$.error.message');
        IF r_error IS NOT NULL THEN
            RETURN;
        END IF;
        SELECT
            JSON_VALUE(v_messages, '$.choices[0].message.content')
        INTO r_message
        FROM
            dual;

    END;

    PROCEDURE moderations (
        p_api_key     VARCHAR2,
        p_model       VARCHAR2,
        p_prompt      VARCHAR2,
        r_moderations OUT CLOB,
        r_error       OUT VARCHAR2
    ) AS
        v_req      utl_http.req;
        v_payload  CLOB;
        v_response CLOB;
    BEGIN
        r_error := NULL;
        v_payload := '{"model": "'
                     || p_model
                     || '", "input": "'
                     || j(p_prompt)
                     || '"}';

        pck_api_http.request(v_req, 'POST', 'https://api.openai.com/v1/moderations');
        pck_api_http.request_auth_token(v_req, p_api_key);
        pck_api_http.request_content_type(v_req, 'application/json');
        pck_api_http.request_charset(v_req, 'UTF-8');
        pck_api_http.request_json(v_req, v_payload);
        pck_api_http.response_text(v_req, v_response);
        r_error := JSON_VALUE(v_response, '$.error.message');
        IF r_error IS NOT NULL THEN
            RETURN;
        END IF;
        r_moderations := v_response;
    END;

    PROCEDURE vision (
        p_api_key VARCHAR2,
        p_model   VARCHAR2,
        p_prompt  VARCHAR2,
        p_image   CLOB,
        r_message OUT CLOB,
        r_error   OUT VARCHAR2
    ) AS
        v_req      utl_http.req;
        v_payload  CLOB;
        v_response CLOB;
    BEGIN
        r_error := NULL;
        v_payload := '{
      "model": "'
                     || p_model
                     || '",
      "messages": [
      {
          "role": "user",
          "content": [
          {
              "type": "text",
              "text": "'
                     || j(p_prompt)
                     || '"
          },
          {
              "type": "image_url",
              "image_url": {
              "url": "data:image/png;base64,'
                     || p_image
                     || '"
              }
          }
          ]
      }
      ],
      "max_tokens": 600
    }';

        pck_api_http.request(v_req, 'POST', 'https://api.openai.com/v1/chat/completions');
        pck_api_http.request_auth_token(v_req, p_api_key);
        pck_api_http.request_content_type(v_req, 'application/json');
        pck_api_http.request_charset(v_req, 'UTF-8');
        pck_api_http.request_json(v_req, v_payload);
        pck_api_http.response_text(v_req, v_response);
        r_error := JSON_VALUE(v_response, '$.error.message');
        IF r_error IS NOT NULL THEN
            RETURN;
        END IF;
        r_message := v_response;
    END;

    PROCEDURE image (
        p_api_key VARCHAR2,
        p_model   VARCHAR2,
        p_prompt  VARCHAR2,
        p_n       NUMBER,
        p_size    VARCHAR2,
        r_error   OUT VARCHAR2,
        r_image   OUT CLOB
    ) AS

        v_url     VARCHAR2(4000 CHAR);
        v_payload CLOB;
        v_req     utl_http.req;
        v_blob    BLOB;
        v_clob    CLOB;
        j_obj     json_object_t;
        j_arr     json_array_t;
        j_val     json_object_t;
    BEGIN
        r_error := NULL;
        v_url := 'https://api.openai.com/v1/images/generations';
        v_payload := '{
        "model": "'
                     || p_model
                     || '",
        "prompt": "'
                     || j(p_prompt)
                     || '",
        "n": '
                     || p_n
                     || ',
        "size": "'
                     || p_size
                     || '"
      }';

        pck_api_http.request(v_req, 'POST', v_url);
        pck_api_http.request_auth_token(v_req, p_api_key);
        pck_api_http.request_content_type(v_req, 'application/json');
        pck_api_http.request_charset(v_req, 'UTF-8');
        pck_api_http.request_json(v_req, v_payload);
        pck_api_http.response_binary(v_req, v_blob);
        v_clob := pck_api_lob.blob_to_clob(v_blob);
        r_error := JSON_VALUE(v_clob, '$.error.message');
        IF r_error IS NOT NULL THEN
            RETURN;
        END IF;
        j_obj := json_object_t.parse(v_clob);
        j_arr := j_obj.get_array('data');
        j_val := treat(j_arr.get(0) AS json_object_t);
        r_image := j_val.get_clob('b64_json');
    END;

END;
/


-- sqlcl_snapshot {"hash":"46c88b1c98609a12bfe02cfd6975a6173aef62bb","type":"PACKAGE_BODY","name":"PCK_API_OPENAI","schemaName":"ODBVUE","sxml":""}
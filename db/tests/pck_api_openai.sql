DECLARE
  c_api_key VARCHAR2(2000 CHAR) := '****************';
  r_message CLOB;
  r_error VARCHAR2(2000 CHAR);
BEGIN

    DBMS_OUTPUT.PUT_LINE('Testing OpenAI API');   
    DBMS_OUTPUT.PUT_LINE('');   

    DBMS_OUTPUT.PUT_LINE('RESPONSES');   

    pck_api_openai.responses(
        p_api_key => c_api_key,
        p_model => 'gpt-5',
        p_input => 'Please tell me a joke about databases.',
        r_output => r_message,
        r_error => r_error
    );

    IF r_error IS NOT NULL THEN
        DBMS_OUTPUT.PUT_LINE('Error: ' || r_error);
        RETURN;
    END IF;

    DBMS_OUTPUT.PUT_LINE(r_message);
    DBMS_OUTPUT.PUT_LINE('');   

END;
/
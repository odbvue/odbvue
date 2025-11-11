SET FEEDBACK OFF;

PROMPT ========== REQUIRED ==========

-- TEST 1.1: required - POSITIVE (non-empty value)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('John', '{"type":"required","message":"Name is required"}');
  DBMS_OUTPUT.put_line('TEST 1.1 (required - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 1.2: required - NEGATIVE (empty value)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('', '{"type":"required","message":"Name is required"}');
  DBMS_OUTPUT.put_line('TEST 1.2 (required - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== MIN-LENGTH ==========

-- TEST 2.1: min-length - POSITIVE (length meets minimum)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('Hello', '{"type":"min-length","params":3,"message":"Min 3 chars"}');
  DBMS_OUTPUT.put_line('TEST 2.1 (min-length - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 2.2: min-length - NEGATIVE (length below minimum)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('Hi', '{"type":"min-length","params":3,"message":"Min 3 chars"}');
  DBMS_OUTPUT.put_line('TEST 2.2 (min-length - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== MAX-LENGTH ==========

-- TEST 3.1: max-length - POSITIVE (length within maximum)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('Hi', '{"type":"max-length","params":5,"message":"Max 5 chars"}');
  DBMS_OUTPUT.put_line('TEST 3.1 (max-length - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 3.2: max-length - NEGATIVE (length exceeds maximum)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('HelloWorld', '{"type":"max-length","params":5,"message":"Max 5 chars"}');
  DBMS_OUTPUT.put_line('TEST 3.2 (max-length - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== EQUALS ==========

-- TEST 4.1: equals - POSITIVE (values match)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('admin', '{"type":"equals","params":"admin","message":"Must be admin"}');
  DBMS_OUTPUT.put_line('TEST 4.1 (equals - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 4.2: equals - NEGATIVE (values do not match)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('user', '{"type":"equals","params":"admin","message":"Must be admin"}');
  DBMS_OUTPUT.put_line('TEST 4.2 (equals - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== EQUALS-NOT ==========

-- TEST 5.1: equals-not - POSITIVE (values are different)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('user', '{"type":"equals-not","params":"admin","message":"Cannot be admin"}');
  DBMS_OUTPUT.put_line('TEST 5.1 (equals-not - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 5.2: equals-not - NEGATIVE (values are the same)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('admin', '{"type":"equals-not","params":"admin","message":"Cannot be admin"}');
  DBMS_OUTPUT.put_line('TEST 5.2 (equals-not - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== SAME-AS ==========

-- TEST 6.1: same-as - POSITIVE (values match)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('SecurePass123', '{"type":"same-as","params":"SecurePass123","message":"Passwords must match"}');
  DBMS_OUTPUT.put_line('TEST 6.1 (same-as - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 6.2: same-as - NEGATIVE (values do not match)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('SecurePass123', '{"type":"same-as","params":"DifferentPass","message":"Passwords must match"}');
  DBMS_OUTPUT.put_line('TEST 6.2 (same-as - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== STARTS-WITH ==========

-- TEST 7.1: starts-with - POSITIVE (starts with prefix)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('https://example.com', '{"type":"starts-with","params":"https","message":"Must start with https"}');
  DBMS_OUTPUT.put_line('TEST 7.1 (starts-with - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 7.2: starts-with - NEGATIVE (does not start with prefix)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('http://example.com', '{"type":"starts-with","params":"https","message":"Must start with https"}');
  DBMS_OUTPUT.put_line('TEST 7.2 (starts-with - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== ENDS-WITH ==========

-- TEST 8.1: ends-with - POSITIVE (ends with suffix)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('user@example.com', '{"type":"ends-with","params":".com","message":"Must end with .com"}');
  DBMS_OUTPUT.put_line('TEST 8.1 (ends-with - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 8.2: ends-with - NEGATIVE (does not end with suffix)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('user@example.org', '{"type":"ends-with","params":".com","message":"Must end with .com"}');
  DBMS_OUTPUT.put_line('TEST 8.2 (ends-with - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== CONTAINS ==========

-- TEST 9.1: contains - POSITIVE (contains substring)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('Hello World', '{"type":"contains","params":"World","message":"Must contain World"}');
  DBMS_OUTPUT.put_line('TEST 9.1 (contains - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 9.2: contains - NEGATIVE (does not contain substring)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('Hello There', '{"type":"contains","params":"World","message":"Must contain World"}');
  DBMS_OUTPUT.put_line('TEST 9.2 (contains - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== GREATER-THAN ==========

-- TEST 10.1: greater-than - POSITIVE (value greater than param)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('100', '{"type":"greater-than","params":50,"message":"Must be > 50"}');
  DBMS_OUTPUT.put_line('TEST 10.1 (greater-than - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 10.2: greater-than - NEGATIVE (value not greater than param)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('25', '{"type":"greater-than","params":50,"message":"Must be > 50"}');
  DBMS_OUTPUT.put_line('TEST 10.2 (greater-than - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== LESS-THAN ==========

-- TEST 11.1: less-than - POSITIVE (value less than param)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('30', '{"type":"less-than","params":50,"message":"Must be < 50"}');
  DBMS_OUTPUT.put_line('TEST 11.1 (less-than - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 11.2: less-than - NEGATIVE (value not less than param)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('75', '{"type":"less-than","params":50,"message":"Must be < 50"}');
  DBMS_OUTPUT.put_line('TEST 11.2 (less-than - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== IN-RANGE ==========

-- TEST 12.1: in-range - POSITIVE (value within range)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('15', '{"type":"in-range","params":[10,20],"message":"Must be between 10 and 20"}');
  DBMS_OUTPUT.put_line('TEST 12.1 (in-range - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 12.2: in-range - NEGATIVE (value outside range)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('25', '{"type":"in-range","params":[10,20],"message":"Must be between 10 and 20"}');
  DBMS_OUTPUT.put_line('TEST 12.2 (in-range - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== INCLUDES ==========

-- TEST 13.1: includes - POSITIVE (value in list)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('green', '{"type":"includes","params":["red","green","blue"],"message":"Invalid color"}');
  DBMS_OUTPUT.put_line('TEST 13.1 (includes - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 13.2: includes - NEGATIVE (value not in list)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('yellow', '{"type":"includes","params":["red","green","blue"],"message":"Invalid color"}');
  DBMS_OUTPUT.put_line('TEST 13.2 (includes - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== SET ==========

-- TEST 14.1: set - POSITIVE (value in set)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('active', '{"type":"set","params":["active","inactive","pending"],"message":"Invalid status"}');
  DBMS_OUTPUT.put_line('TEST 14.1 (set - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 14.2: set - NEGATIVE (value not in set)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('deleted', '{"type":"set","params":["active","inactive","pending"],"message":"Invalid status"}');
  DBMS_OUTPUT.put_line('TEST 14.2 (set - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== EMAIL ==========

-- TEST 15.1: email - POSITIVE (valid email)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('user@example.com', '{"type":"email","message":"Invalid email"}');
  DBMS_OUTPUT.put_line('TEST 15.1 (email - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 15.2: email - NEGATIVE (invalid email)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('notanemail', '{"type":"email","message":"Invalid email"}');
  DBMS_OUTPUT.put_line('TEST 15.2 (email - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== URL ==========

-- TEST 16.1: url - POSITIVE (valid URL)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('https://example.com/path', '{"type":"url","message":"Invalid URL"}');
  DBMS_OUTPUT.put_line('TEST 16.1 (url - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 16.2: url - NEGATIVE (invalid URL)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('not a url', '{"type":"url","message":"Invalid URL"}');
  DBMS_OUTPUT.put_line('TEST 16.2 (url - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== PASSWORD ==========

-- TEST 17.1: password - POSITIVE (valid password)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('SecurePass123', '{"type":"password","message":"Invalid password"}');
  DBMS_OUTPUT.put_line('TEST 17.1 (password - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 17.2: password - NEGATIVE (password too short)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('Pass1', '{"type":"password","message":"Invalid password"}');
  DBMS_OUTPUT.put_line('TEST 17.2 (password - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== IP ==========

-- TEST 18.1: ip - POSITIVE (valid IPv4)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('192.168.1.1', '{"type":"ip","message":"Invalid IP"}');
  DBMS_OUTPUT.put_line('TEST 18.1 (ip - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 18.2: ip - NEGATIVE (invalid IPv4)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('999.999.999.999', '{"type":"ip","message":"Invalid IP"}');
  DBMS_OUTPUT.put_line('TEST 18.2 (ip - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== REGEXP ==========

-- TEST 19.1: regexp - POSITIVE (matches pattern)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('ABC123', '{"type":"regexp","params":"^[A-Z]{3}[0-9]{3}$","message":"Invalid format"}');
  DBMS_OUTPUT.put_line('TEST 19.1 (regexp - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 19.2: regexp - NEGATIVE (does not match pattern)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('XYZ', '{"type":"regexp","params":"^[A-Z]{3}[0-9]{3}$","message":"Invalid format"}');
  DBMS_OUTPUT.put_line('TEST 19.2 (regexp - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== IS-JSON ==========

-- TEST 20.1: is-json - POSITIVE (valid JSON)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('{"key":"value"}', '{"type":"is-json","message":"Invalid JSON"}');
  DBMS_OUTPUT.put_line('TEST 20.1 (is-json - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 20.2: is-json - NEGATIVE (invalid JSON)
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('not json', '{"type":"is-json","message":"Invalid JSON"}');
  DBMS_OUTPUT.put_line('TEST 20.2 (is-json - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== MULTI-RULE CASE ==========

-- TEST 21: Multiple rules - all must pass
DECLARE
  v_msg VARCHAR2(4000);
  v_rules CLOB := '[
    {"type":"required","message":"Email is required"},
    {"type":"min-length","params":5,"message":"Email must be at least 5 chars"},
    {"type":"email","message":"Must be a valid email"}
  ]';
BEGIN
  v_msg := pck_api_validate.validate('user@example.com', v_rules);
  DBMS_OUTPUT.put_line('TEST 21 (multi-rule - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 22: Multiple rules - fails on first violation
DECLARE
  v_msg VARCHAR2(4000);
  v_rules CLOB := '[
    {"type":"required","message":"Email is required"},
    {"type":"min-length","params":5,"message":"Email must be at least 5 chars"},
    {"type":"email","message":"Must be a valid email"}
  ]';
BEGIN
  v_msg := pck_api_validate.validate('a@b.c', v_rules);
  DBMS_OUTPUT.put_line('TEST 22 (multi-rule - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

PROMPT ========== NO MESSAGE CASE ==========

-- TEST 23: Rule without custom message - uses default
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('123', '{"type":"required"}');
  DBMS_OUTPUT.put_line('TEST 23 (no message - POSITIVE): '||NVL(v_msg,'OK'));
END;
/

-- TEST 24: Rule without custom message - negative case shows default message
DECLARE
  v_msg VARCHAR2(4000);
BEGIN
  v_msg := pck_api_validate.validate('', '{"type":"required"}');
  DBMS_OUTPUT.put_line('TEST 24 (no message - NEGATIVE): '||NVL(v_msg,'OK'));
END;
/

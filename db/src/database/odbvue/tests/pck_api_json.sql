DECLARE
  c clob;
  r clob;
  v clob;
  p VARCHAR2(2000 CHAR);
  b boolean;
  n PLS_INTEGER;

  PROCEDURE print(c clob DEFAULT NULL)
  AS
  BEGIN
    dbms_output.put_line(dbms_lob.substr(c, 4000));
  END;

  FUNCTION tf(b IN boolean) RETURN VARCHAR2
  AS
  BEGIN
    RETURN CASE WHEN b THEN 'true' ELSE 'false' END;
  END;

BEGIN

print('Init');
c:= pck_api_json.init;
print(c);
print;

print('Exists');
c:='{"a":1,"b":{"c":2},"d":[1,2,3]}';
p := '$.a';
b := pck_api_json.exists(c, p);
print(p || ' in ' || c || ' => ' || tf(b)); -- true
p := '$.b.c';
b := pck_api_json.exists(c, p);
print(p || ' in ' || c || ' => ' || tf(b)); -- true
p := '$.b.d';
b := pck_api_json.exists(c, p);
print(p || ' in ' || c || ' => ' || tf(b)); -- false  
p := '$.x';
b := pck_api_json.exists(c, p);
print(p || ' in ' || c || ' => ' || tf(b)); -- false
p := '$.d[1]';
b := pck_api_json.exists(c, p);
print(p || ' in ' || c || ' => ' || tf(b)); -- true
p := '$.d[10]';
b := pck_api_json.exists(c, p);
print(p || ' in ' || c || ' => ' || tf(b)); -- false
print;

print('Read');
c:='{"a":1,"b":{"c":2},"d":[1,2,3]}';
p := '$.a';
r := pck_api_json.read(c, p);
print(p || ' from ' || c || ' => ' || r); -- 1
p := '$.b';
r := pck_api_json.read(c, p);
print(p || ' from ' || c || ' => ' || r); -- {"c":2}
p := '$.d[2]';
r := pck_api_json.read(c, p);
print(p || ' from ' || c || ' => ' || r); -- 3 (index starts with 0)
p := '$.d[10]';
r := pck_api_json.read(c, p);
print(p || ' from ' || c || ' => ' || r); -- NULL
print;

print('Typeof');

c:='{"a":1,"b":{"c":2},"d":[1,2,3]}';
p := '$.a';
r := pck_api_json.typeof(c, p);
print(p || ' type in ' || c || ' => ' || r); -- number
p := '$.b';
r := pck_api_json.typeof(c, p);
print(p || ' type in ' || c || ' => ' || r); -- object
p := '$.d';
r := pck_api_json.typeof(c, p);
print(p || ' type in ' || c || ' => ' || r); -- array
p := '$.x';
r := pck_api_json.typeof(c, p);
print(p || ' type in ' || c || ' => ' || r); -- undefined
print;

print('Elcount');
c:='{"a":1,"b":{"c":2},"d":[1,2,3],"e":{"f":4,"g":5}}';
p := '$.a';
n := pck_api_json.elcount(c, p);
print(p || ' element count in ' || c || ' => ' || n); -- 1
p := '$.d';
n := pck_api_json.elcount(c, p);
print(p || ' element count in ' || c || ' => ' || n); -- 3
p := '$.e';
n := pck_api_json.elcount(c, p);
print(p || ' element count in ' || c || ' => ' || n); -- 2
print;

print('Keys');
c:='{"a":1,"b":{"c":2},"d":[1,2,3]}';
p := '$';
r := pck_api_json.keys(c, p);
print(p || ' keys in ' || c || ' => ' || r); -- 1
p := '$.b';
r := pck_api_json.keys(c, p);
print(p || ' keys in ' || c || ' => ' || r); -- 1
p := '$.d';
r := pck_api_json.keys(c, p);
print(p || ' keys in ' || c || ' => ' || r); -- []
print;

print ('Write');
--
c:='{"a":1,"b":{"c":2},"d":[1,2,3]}';
r:=c;
p := '$.a';
v:='42';
pck_api_json.write(r, p, v);
print(v || ' at ' || p || ' in ' || c || ' => ' || r);
--
c:='{"a":1,"b":{"c":2},"d":[1,2,3]}';
r:=c;
p := '$.b.c';
v:='{"e":"f"}';
pck_api_json.write(r, p, v);
print(v || ' at ' || p || ' in ' || c || ' => ' || r);
--
c:='{"a":1,"b":{"c":2},"d":[1,2,3]}';
r:=c;
p := '$.d';
v:=null;
pck_api_json.write(r, p, v);
print(COALESCE(v, 'null') || ' at ' || p || ' in ' || c || ' => ' || r);
--c:='{"a":1,"b":{"c":2},"d":[1,2,3]}';
r:=c;
p := '$';
v:=null;
pck_api_json.write(r, p, v);
print(COALESCE(v, 'null') || ' at ' || p || ' in ' || c || ' => ' || r);
--
print;

print('Print');
c:='{"a":1,"b":{"c":2},"d":[1,2,3]}';
r:=c;
pck_api_json.print(r); 
print(c || ' => ' || CHR(10) || r);
print;

print('To XML');
c:='{"a":1,"b":{"c":{"d":"e"}},"f":[1,2,3],"g":"hello world","h":true,"i":null,"j":3.14}';
r:=pck_api_json.to_xml(c);
print(c || ' => ' || CHR(10) || r);
print;

print('To YAML');
c:='{"a":1,"b":{"c":{"d":"e"}},"f":[1,2,3],"g":"hello world","h":true,"i":null,"j":3.14}';
r:=pck_api_json.to_yaml(c);
print(c || ' => ' || CHR(10) || r);
print;

end;
/


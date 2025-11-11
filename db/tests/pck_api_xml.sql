DECLARE
  c clob := '<root>
  <a>1</a>
  <b>
    <c>
      <d>e</d>
    </c>
  </b>
  <f>
    <item>1</item>
    <item>2</item>
    <item>3</item>
  </f>
  <g>hello world</g>
  <h>true</h>
  <i>null</i>
  <j>3.14</j>
</root>';
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

print('Begin');
print(c);
print;

print('Init');
r:= pck_api_xml.init;
print(r);
print;

print('Exists');
p := '$.a';
b := pck_api_xml.exists(c, p);
print(p || ' => ' || tf(b)); -- true
p := '$.b.c';
b := pck_api_xml.exists(c, p);
print(p || ' => ' || tf(b)); -- true
p := '$.b.d';
b := pck_api_xml.exists(c, p);
print(p || ' => ' || tf(b)); -- false
p := '$.x';
b := pck_api_xml.exists(c, p);
print(p || ' => ' || tf(b)); -- false
p := '$.f[1]';
b := pck_api_xml.exists(c, p);
print(p || ' => ' || tf(b)); -- true
p := '$.f[10]';
b := pck_api_xml.exists(c, p);
print(p || ' => ' || tf(b)); -- false
print;

print('Read');
p := '$.a';
r := pck_api_xml.read(c, p);
print(p || ' => ' || r); -- 1
p := '$.b';
r := pck_api_xml.read(c, p);
print(p || ' => ' || r); -- <c>2</c>
p := '$.f[3]';
r := pck_api_xml.read(c, p);
print(p || ' => ' || r); -- 3
p := '$.f[10]';
r := pck_api_xml.read(c, p);
print(p || ' => ' || r); -- NULL
print;

print('Typeof');
p := '$.a';
r := pck_api_xml.typeof(c, p);
print(p || ' => ' || r); -- string or number
p := '$.b';
r := pck_api_xml.typeof(c, p);
print(p || ' => ' || r); -- object
p := '$.f';
r := pck_api_xml.typeof(c, p);
print(p || ' => ' || r); -- array
p := '$.x';
r := pck_api_xml.typeof(c, p);
print(p || ' => ' || r); -- undefined
print;

print('Elcount');
p := '$.a';
n := pck_api_xml.elcount(c, p);
print(p || ' element count  => ' || n); -- 1
p := '$.f';
n := pck_api_xml.elcount(c, p);
print(p || ' element count in => ' || n); -- 3
p := '$';
n := pck_api_xml.elcount(c, p);
print(p || ' element count in => ' || n); -- 7
print;

print('Keys');
p := '$';
r := pck_api_xml.keys(c, p);
print(p || ' keys => ' || r); -- ["a","b","f","g","h","i","j"]
p := '$.b';
r := pck_api_xml.keys(c, p);
print(p || ' keys => ' || r); -- ["c"]
p := '$.f';
r := pck_api_xml.keys(c, p);
print(p || ' keys  => ' || r); -- []
print;

print ('Write');
--
r:=c;
p := '$.a';
v:='42';
pck_api_xml.write(r, p, v);
print(v || ' at ' || p || ' => ' || r);
--
r:=c;
p := '$.a.b.c';
v:='<x><y>z</y></x>';
pck_api_xml.write(r, p, v);
print(v || ' at ' || p || ' => ' || r);
--
r:=c;
p := '$.b';
v:=null;
pck_api_xml.write(r, p, v);
print(COALESCE(v, 'null') || ' at ' || p || ' => ' || r);
r:=c;
p := '$';
v:=null;
pck_api_xml.write(r, p, v);
print(COALESCE(v, 'null') || ' at ' || p || ' => ' || r);
--
print;

print('Print');
r:='<root><a>1</a><b><c>2</c></b><d><item>1</item><item>2</item><item>3</item></d></root>';
v:=r;
pck_api_xml.print(v);
print(r || ' => ' || CHR(10) || v);
print;

print('To YAML');
r:=pck_api_xml.to_yaml(c);
print(r);
print;

print('To JSON');
r:=pck_api_xml.to_json(c);
print(r);
print;

end;
/


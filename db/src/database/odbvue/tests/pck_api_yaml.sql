DECLARE
  c CLOB := 'a: 1
b:
  c:
    d: e
f:
  - 1
  - 2
  - 3
g: hello world
h: true
i: null
j: 3.14';
 
    r CLOB;
    p VARCHAR2(2000 CHAR);
    v CLOB;
    b BOOLEAN;
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

    print('YAML Input:');
    print('-------------------');
    print(c);
    print('-------------------');
    print;

    print('Init');
    r:= pck_api_yaml.init;
    print(r || ' => ' || '(0 bytes)');
    print;   

print('Exists');
p := '$.a';
b := pck_api_yaml.exists(c, p);
print(p || ' => ' || tf(b)); -- true
p := '$.b.c';
b := pck_api_yaml.exists(c, p);
print(p || ' => ' || tf(b)); -- true
p := '$.c.d';
b := pck_api_yaml.exists(c, p);
print(p || ' => ' || tf(b)); -- false
p := '$.x';
b := pck_api_yaml.exists(c, p);
print(p || ' => ' || tf(b)); -- false
p := '$.f[0]';
b := pck_api_yaml.exists(c, p);
print(p || ' => ' || tf(b)); -- true
p := '$.f[10]';
b := pck_api_yaml.exists(c, p);
print(p || ' => ' || tf(b)); -- false
print;

print('Read');
p := '$.a';
r := pck_api_yaml.read(c, p);
print(p || ' => ' || r); -- 1
p := '$.b';
r := pck_api_yaml.read(c, p);
print(p || ' => ' || r); -- {c: {d: e}}
p := '$.f[2]';
r := pck_api_yaml.read(c, p);
print(p || ' => ' || r); -- {item: 3}
p := '$.f[10]';
r := pck_api_yaml.read(c, p);
print(p || ' => ' || r); -- NULL
print;

print('Typeof');
p := '$.a';
r := pck_api_yaml.typeof(c, p);
print(p || ' => ' || r); -- number
p := '$.b';
r := pck_api_yaml.typeof(c, p);
print(p || ' => ' || r); -- object
p := '$.f';
r := pck_api_yaml.typeof(c, p);
print(p || ' => ' || r); -- array
p := '$.x';
r := pck_api_yaml.typeof(c, p);
print(p || ' => ' || r); -- undefined
print;

print('Elcount');
p := '$.a';
n := pck_api_yaml.elcount(c, p);
print(p || ' element count  => ' || n); -- 1
p := '$.f';
n := pck_api_yaml.elcount(c, p);
print(p || ' element count in => ' || n); -- 3
p := '$.root';
n := pck_api_yaml.elcount(c, p);
print(p || ' element count in => ' || n); -- 7
print;

print('Keys');
p := '$';
r := pck_api_yaml.keys(c, p);
print(p || ' keys => ' || r); -- ["a","b","f","g","h","i","j"]
p := '$.b';
r := pck_api_yaml.keys(c, p);
print(p || ' keys => ' || r); -- ["c"]
p := '$.f';
r := pck_api_yaml.keys(c, p);
print(p || ' keys  => ' || r); -- []
print;

print ('Write');
--
r:=c;
p := '$.a';
v:='42';
pck_api_yaml.write(r, p, v);
print(v || ' at ' || p || ' => ' );
print('----');
print(r);
print('----');
--
r:=c;
p := '$.b.c';
v:='x:
  y:
    z: data';
pck_api_yaml.write(r, p, v);
print(v || ' at ' || p || ' => ');
print('----');
print(r);
print('----');
--
r:=c;
p := '$.b';
v:=null;
pck_api_yaml.write(r, p, v);
print(COALESCE(v, 'null') || ' at ' || p || ' => ');
print('----');
print(r);
print('----');
--
p := '$';
v:=null;
pck_api_yaml.write(r, p, v);
print(COALESCE(v, 'null') || ' at ' || p || ' => ');
--
print('----');
print(r);
print('----');

print('Print');
pck_api_yaml.print(c);
print(r || ' => ' || CHR(10) || c);
print;

print('To XML');
r:=pck_api_yaml.to_xml(c);
print(r);
print;

print('To JSON');
r:=pck_api_yaml.to_json(c);
print(r);
print;

END;
/

CREATE OR REPLACE PACKAGE odbvue.pck_api_xml AS -- Package for handling xml 
    FUNCTION init -- Function to initialize empty xml object 
     RETURN CLOB; -- Returns a clob representing an empty xml object

    FUNCTION EXISTS ( -- Function to check if a path exists in a xml object
        c IN CLOB, -- The xml object as clob
        p IN VARCHAR2 -- The path to check for existence
    ) RETURN BOOLEAN; -- Returns true if the key exists, false otherwise

    FUNCTION read ( -- Function reads by path form a xml object
        c IN CLOB, -- The xml object as clob
        p IN VARCHAR2 -- The path to read
    ) RETURN CLOB; -- Returns the value at the specified path as clob

    FUNCTION typeof ( -- Function to get the type of the value at a specified path
        c IN CLOB, -- The xml object as clob
        p IN VARCHAR2 -- The path to check the type of
    ) RETURN VARCHAR2; -- Returns the type as a string

    FUNCTION elcount ( -- Function to count elements in an array at a specified path
        c IN CLOB, -- The xml object as clob
        p IN VARCHAR2 -- The path to the array
    ) RETURN PLS_INTEGER; -- Returns the count of elements

    FUNCTION keys ( -- Function to get the keys of an object at a specified path
        c IN CLOB, -- The xml object as clob
        p IN VARCHAR2 -- The path to the object
    ) RETURN VARCHAR2; -- Returns a list of keys

    PROCEDURE write ( -- Procedure to replace a value at a specified path 
        c IN OUT NOCOPY CLOB, -- The xml object as clob 
        p IN VARCHAR2, -- The path to insert the value at (object path only, arrays not supported yet)
        v IN CLOB -- The value to insert
    );

    PROCEDURE print ( -- Procedure to pretty-print a xml object
        c IN OUT NOCOPY CLOB -- The xml object as clob
    );

    FUNCTION to_yaml ( -- Function to convert xml object to yaml representation
        c CLOB -- The xml object as clob
    ) RETURN CLOB; -- Returns the yaml representation as clob

    FUNCTION to_json ( -- Function to convert xml object to json representation
        c CLOB -- The xml object as clob
    ) RETURN CLOB; -- Returns the json representation as clob
END pck_api_xml;
/


-- sqlcl_snapshot {"hash":"583a940c4ff1890ef6535d0e768f1677c3f80e79","type":"PACKAGE_SPEC","name":"PCK_API_XML","schemaName":"ODBVUE","sxml":""}
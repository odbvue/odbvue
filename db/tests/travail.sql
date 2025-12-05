-- Travail

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE tra_tasks';
    EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN
            RAISE;
        END IF;
END;
/

CREATE TABLE tra_tasks (
    id NUMBER(19) GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key VARCHAR2(32 CHAR),
    title VARCHAR2(200 CHAR) NOT NULL,
    description CLOB,
    due TIMESTAMP,
    author CHAR(32 CHAR),
    assignee CHAR(32 CHAR),
    created TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    modified TIMESTAMP
);
/

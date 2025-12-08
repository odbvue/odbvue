-- Travail

CREATE OR REPLACE PROCEDURE prc_drop_table_if_exists(table_name IN VARCHAR2) AS
    table_count NUMBER; 
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM user_tables 
    WHERE table_name = UPPER(table_name);
    
    IF table_count > 0 THEN
        EXECUTE IMMEDIATE 'DROP TABLE ' || table_name;
    END IF;
END;
/    

begin
    prc_drop_table_if_exists('tra_items');
    prc_drop_table_if_exists('tra_links');
    prc_drop_table_if_exists('tra_notes');
    prc_drop_table_if_exists('tra_tasks');
    prc_drop_table_if_exists('tra_plans');
end;
/

CREATE TABLE tra_plans (
    id NUMBER(19) GENERATED ALWAYS AS IDENTITY  (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
    key VARCHAR2(30 CHAR) UNIQUE NOT NULL,
    title VARCHAR2(200 CHAR) NOT NULL,
    description VARCHAR2(2000 CHAR),
    due_warning_days NUMBER(5) DEFAULT 7 NOT NULL,
    statuses CLOB, -- JSON array of statuses [{name: string, color: string, done: boolean}]
    author CHAR(32 CHAR),
    created TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    editor CHAR(32 CHAR),
    modified TIMESTAMP
);
/

INSERT INTO tra_plans (key, title, description, author, statuses) 
SELECT 'TRA', 'Default Plan', 'Default plan', uuid, 
    '[
        {"id":"todo", "name": "To Do", "color": "warning", "done": false}, 
        {"id":"doing", "name": "In Progress", "color": "info", "done": false}, 
        {"id":"done", "name": "Done", "color": "success", "done": true}
    ]'
FROM app_users WHERE id = 1;

COMMIT;
/

CREATE TABLE tra_tasks (
    id NUMBER(19) GENERATED ALWAYS AS IDENTITY  (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
    key VARCHAR2(30 CHAR),
    title VARCHAR2(200 CHAR) NOT NULL,
    description CLOB,
    due TIMESTAMP,
    status VARCHAR2(30 CHAR),
    author CHAR(32 CHAR),
    assignee CHAR(32 CHAR),
    created TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    modified TIMESTAMP,
    num VARCHAR2(50 CHAR) GENERATED ALWAYS AS (key || '-' || TO_CHAR(id)) VIRTUAL
);
/

CREATE TABLE tra_links (
    parent_id NUMBER(19) NOT NULL,
    child_id NUMBER(19) NOT NULL
);
/


CREATE TABLE tra_notes (
    id NUMBER(19) GENERATED ALWAYS AS IDENTITY  (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
    task_id NUMBER(19) NOT NULL,
    author CHAR(32 CHAR),
    content CLOB,
    created TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);
/

CREATE TABLE tra_items (
    task_id NUMBER(19) NOT NULL,
    key VARCHAR2(100 CHAR) NOT NULL,
    type VARCHAR2(50 CHAR) NOT NULL,
    value CLOB
);
/

-- exec PRC_ORDSIFY;
--/

drop procedure prc_drop_table_if_exists;
/

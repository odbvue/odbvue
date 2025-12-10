-- Travail

CREATE OR REPLACE PROCEDURE prc_drop_table_if_exists(table_name IN VARCHAR2) AS
BEGIN
    BEGIN
        EXECUTE IMMEDIATE 'DROP TABLE ' || table_name;

    EXCEPTION
        WHEN OTHERS THEN
            NULL;
    END;
END;
/    

begin
    prc_drop_table_if_exists('tra_notes');
    prc_drop_table_if_exists('tra_links');
    prc_drop_table_if_exists('tra_tasks');
    prc_drop_table_if_exists('tra_boards');
end;
/


CREATE TABLE tra_boards (
    key VARCHAR2(30 CHAR) PRIMARY KEY,
    title VARCHAR2(100 CHAR) NOT NULL,
    description CLOB,
    settings CLOB,
    author CHAR(32 CHAR) NOT NULL,
    created TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    editor CHAR(32 CHAR),
    modified TIMESTAMP,
    CONSTRAINT chk_tra_boards_settings CHECK (settings IS JSON)
);
/

INSERT INTO tra_boards (key, title, description, author, settings) 
SELECT 'TRA', 'Travail Board', 'The Travail board.', uuid, 
'{
"due_warn_before_days":5,
"statuses": [
    {"value": "todo", "title": "To Do", "attrs": {"format": {"color": "warning"}}},
    {"value": "doing", "title": "In Progress", "attrs": {"format": {"color": "info"}}},
    {"value": "done", "title": "Done", "attrs": {"format": {"color": "success"}}}
],
"priorities": [
    {"value": "attention", "title": "Attention", "attrs": {"format": {"color": "warning"}}},
    {"value": "high", "title": "High", "attrs": {"format": {"color": "error"}}}
],
"units":"days"
}'
FROM app_users WHERE id = 1;

COMMIT;
/

CREATE TABLE tra_tasks (
    id NUMBER(19) GENERATED ALWAYS AS IDENTITY  (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
    key VARCHAR2(30 CHAR) NOT NULL,
    title VARCHAR2(200 CHAR) NOT NULL,
    description CLOB,

    due TIMESTAMP,
    reminder TIMESTAMP,
    started TIMESTAMP,
    completed TIMESTAMP,
    
    status VARCHAR2(30 CHAR),
    priority VARCHAR2(30 CHAR),

    estimated NUMBER(19) DEFAULT 0 NOT NULL,
    remaining NUMBER(19) DEFAULT 0 NOT NULL,
    invested NUMBER(19) DEFAULT 0 NOT NULL,

    assignee CHAR(32 CHAR),

    author CHAR(32 CHAR) NOT NULL,
    created TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    editor CHAR(32 CHAR),
    modified TIMESTAMP,

    num VARCHAR2(50 CHAR) GENERATED ALWAYS AS (key || '-' || TO_CHAR(id)) VIRTUAL

);
/

CREATE INDEX idx_tra_tasks_num ON tra_tasks(num);
CREATE INDEX idx_tra_tasks_key ON tra_tasks(key);
CREATE INDEX idx_tra_tasks_status ON tra_tasks(status);
CREATE INDEX idx_tra_tasks_priority ON tra_tasks(priority);
CREATE INDEX idx_tra_tasks_assignee ON tra_tasks(assignee);
CREATE INDEX idx_tra_tasks_due ON tra_tasks(due);
CREATE INDEX idx_tra_tasks_reminder ON tra_tasks(reminder);
CREATE INDEX idx_tra_tasks_started ON tra_tasks(started);
CREATE INDEX idx_tra_tasks_completed ON tra_tasks(completed);
CREATE INDEX idx_tra_tasks_author ON tra_tasks(author);
CREATE INDEX idx_tra_tasks_created ON tra_tasks(created);
/ 

CREATE TABLE tra_links (
    parent_id NUMBER(19) NOT NULL,
    child_id NUMBER(19) NOT NULL,
    CONSTRAINT cpk_tra_links PRIMARY KEY (parent_id, child_id),
    CONSTRAINT cfk_tra_links_parent FOREIGN KEY (parent_id) REFERENCES tra_tasks(id) ON DELETE CASCADE,
    CONSTRAINT cfk_tra_links_child FOREIGN KEY (child_id) REFERENCES tra_tasks(id) ON DELETE CASCADE
);
/

CREATE TABLE tra_notes (
    id NUMBER(19) GENERATED ALWAYS AS IDENTITY  (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
    task_id NUMBER(19) NOT NULL,
    storage_id CHAR(32 CHAR),
    content CLOB,
    assistant CLOB,
    author CHAR(32 CHAR),
    created TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    editor CHAR(32 CHAR),
    modified TIMESTAMP,
    CONSTRAINT cfk_tra_notes_storage FOREIGN KEY (storage_id) REFERENCES app_storage(id),
    CONSTRAINT cfk_tra_notes_task FOREIGN KEY (task_id) REFERENCES tra_tasks(id)
);

CREATE INDEX idx_tra_notes_task_id ON tra_notes(task_id);
CREATE INDEX idx_tra_notes_storage_id ON tra_notes(storage_id);
CREATE INDEX idx_tra_notes_created ON tra_notes(created);
/

drop procedure prc_drop_table_if_exists;
/


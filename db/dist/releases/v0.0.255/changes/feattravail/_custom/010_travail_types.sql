-- liquibase formatted sql
-- changeset  SqlCl:1766848419975 stripComments:false logicalFilePath:feattravail\_custom\010_travail_types.sql
-- sqlcl_snapshot dist\releases\next\changes\feattravail\_custom\010_travail_types.sql:null:null:custom


BEGIN
EXECUTE IMMEDIATE 'ALTER TABLE odbvue.tra_tasks ADD (
    type VARCHAR2(30 CHAR)
)'  ;
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -01430 THEN
            RAISE;
        END IF;
END;
/

UPDATE tra_boards SET settings = 
'{
"due_warn_before_days":5,
"statuses": [
    {"value": "todo", "title": "To Do", "attrs": {"format": {"color": "warning"}}},
    {"value": "doing", "title": "In Progress", "attrs": {"format": {"color": "info"}}},
    {"value": "done", "title": "Done", "attrs": {"format": {"color": "success"}}}
],
"types": [
    {"value": "feature", "title": "Feature", "attrs": {"format": {"color": "success"}}},
    {"value": "bug", "title": "Bug", "attrs": {"format": {"color": "error"}}},
    {"value": "chore", "title": "Chore", "attrs": {"format": {"color": "info"}}}
],
"priorities": [
    {"value": "attention", "title": "Attention", "attrs": {"format": {"color": "warning"}}},
    {"value": "high", "title": "High", "attrs": {"format": {"color": "error"}}}
],
"units":"days"
}'
WHERE 1=1;


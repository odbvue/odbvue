-- liquibase formatted sql
-- changeset  SqlCl:1765288699517 stripComments:false logicalFilePath:feattravail\_custom\010_travail_initial_data.sql
-- sqlcl_snapshot dist\releases\next\changes\feattravail\_custom\010_travail_initial_data.sql:null:null:custom

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
FROM app_users WHERE id = 1
AND NOT EXISTS (SELECT 1 FROM tra_boards WHERE key = 'TRA');


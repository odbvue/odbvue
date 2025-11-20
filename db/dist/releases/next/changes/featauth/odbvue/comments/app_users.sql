-- liquibase formatted sql
-- changeset odbvue:1763641552041 stripComments:false  logicalFilePath:featauth\odbvue\comments\app_users.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_users.sql:86c3f80ddd51a5d9209eb97ec9f4c5c52b101d7e:20bfb6d872326ff5048b5a6873c5130f27ba7860:alter

COMMENT ON TABLE odbvue.app_users IS
    'Table for storing and processing user data';

COMMENT ON COLUMN odbvue.app_users.accessed IS
    'Date and time when user performed last successful login';

COMMENT ON COLUMN odbvue.app_users.attempted IS
    'Timestamp of the last login attempt';

COMMENT ON COLUMN odbvue.app_users.attempts IS
    'Number of authentication attempts';

COMMENT ON COLUMN odbvue.app_users.created IS
    'Date and time when user was created';

COMMENT ON COLUMN odbvue.app_users.fullname IS
    'Full name';

COMMENT ON COLUMN odbvue.app_users.id IS
    'Primary key';

COMMENT ON COLUMN odbvue.app_users.password IS
    'Password';

COMMENT ON COLUMN odbvue.app_users.status IS
    'Status (A - active; D - disabled; N - uNverified)';

COMMENT ON COLUMN odbvue.app_users.username IS
    'Username';

COMMENT ON COLUMN odbvue.app_users.uuid IS
    'Unique user identifier';


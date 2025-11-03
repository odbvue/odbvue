# Setting up

## Prepare Environment

1. [Enable Oracle Autonomous Database for Local Development](../../guide/i13e/local-development/database.md)

2. [Enable Oracle Autonomous Database in Oracle Cloud Infrastructure](../../guide/i13e/oci/manage.md)

3. [Download and install SQLcl for Local Development](https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/download/)

---

Verify that you can connect to local development database:

```bash
sql admin/************@127.0.0.1:1521/myatp
SELECT USER AS whoami FROM dual;
# WHOAMI 
# ______
# ADMIN
exit
```

//todo

000_before_deploy.sql
777_marker.sql
999_after_deploy.sql
install.sql

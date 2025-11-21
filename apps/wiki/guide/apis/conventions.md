# Conventions

## Code Organization

All tables and business logic shall be organized in packages by domain. 

- `API` - common, reusable packages

- `APP` - main application tables and packages
- `XYZ` - tables and packages for feature XYX

## Usage of object types

| Ok to use | :warning: With caution              | :triangular_flag_on_post: Red flag                   |
| --------- | ----------------------------------- | ---------------------------------------------------- |
| Tables    | Views                               | Business logic in triggers                           |
| Sequences | Types                               | Java / C / etc. procedures                           |
| Indexes   | Standalone procedures and functions |                                                      |
| Packages  | Materialized views                  |                                                      |
| Jobs      |                                     |                                                      |

## Naming Conventions

### Common

All object names are in single and self describing.

Length of object names is limited to 30 characters.

Object names have underscore separated three letter prefix describing business domain.

ANSII SQL syntax must be used wherever possible.

All object names must have prefix of 3 letters representing modules.

Oracle reserved words must be in upper case

```sql
SELECT word FROM v$reserved_words WHERE reserved = 'Y';
```

### Tables

Table names are in single and self describing.

Tables and columns must have comments.

If name is too long, then use abbreviations.

Allowed data types: `VARCHAR2(X CHAR) - max 2000 char, CHAR, NUMBER(X,Y), CLOB, DATE, TIMESTAMP(6), BLOB`.

Column names are in single.

Primary key is named: `id`. Data type: `NUMBER(19, 0)`.

Foreign keys are named: `table_name_id`.

`NOT NULL` constraints must be defined, where needed.

Comments are mandatory for tables and columns.

Primary key constraint must be named: `pk_table name`.

Foreign key constraint must be named: `fk_table name`. *N.B. Index is not automatically created and should be added as well.*

Enumerated fields must have check constraints.

JSON field must have JSON constraint.

```sql
CREATE TABLE app_storage (
   id NUMBER(19) NOT NULL,
   guid CHAR(32 CHAR) DEFAULT SYS_GUID() NOT NULL,
   id_user NUMBER(19),
   file_name VARCHAR2(2000 CHAR),
   file_size NUMBER(19),
   file_ext VARCHAR2(30 CHAR),
   content BLOB,
   sharing CHAR(1 CHAR) DEFAULT 'Y' NOT NULL,
   created TIMESTAMP(6) DEFAULT SYSTIMESTAMP NOT NULL
)
LOB(content) STORE AS SECUREFILE(
   CACHE
   NOLOGGING
);
/

COMMENT ON TABLE app_storage IS 'Table for storing and processing attachment data';
..
COMMENT ON COLUMN app_storage.id_user IS 'User who created attachment. Reference to APP_USERS.ID';
COMMENT ON COLUMN app_storage.sharing IS 'Is attachment shareable to other users (Y - yes, N - No)';
/

ALTER TABLE app_storage ADD CONSTRAINT pk_app_storage PRIMARY KEY (id);
/

ALTER TABLE app_storage ADD CONSTRAINT fk_app_storage_user FOREIGN KEY (id_user) REFERENCES app_users(id);
CREATE INDEX idx_app_storage_user ON app_storage(id_user) ONLINE;
/

ALTER TABLE app_storage ADD CONSTRAINT ch_app_storage_sharing CHECK sharing IN ('Y','N');
/
```

### Views

View names must have prefix `v_`.

### Sequences

Sequence shall be named `seq_table_name`.

### Indexes

Indexes shall be named `idx_table_name_column_name(s)`.

Unique indexes shall be named `idq_`.

### PL\SQL

> [!IMPORTANT]
> package procedures that are prefixed with `get_, post_, put_, delete_` will be auto converted to ORDS REST API.

Package, procedure and variable names are in single an self describing.

Input and output variables must reference table column data types (..%TYPE) whenever possible.

Prefix, purpose

- `p_` Incoming parameters
- `v_` Local variables
- `g_` Global variables
- `vc_` Local constants
- `gc_` Global constants
- `c_` Cursors
- `e_` Exception
- `r_` Outgoing parameters
- `r_` Record
- `t_` Type

## Best practices

Designing an effective database structure is crucial for performance, scalability, and maintainability. Here are some common best practices, particularly in the context of Oracle databases, with examples:

1. **Normalization** - to organize data to reduce redundancy and improve data integrity.

Example:

Instead of storing customer information repeatedly in an Orders table, create a separate Customers table and reference it using a foreign key.

2. **Use of Primary Keys** - to uniquely identify each record in a table.

Example:

In a Products table, each product could have a unique ID as the primary key.

3. **Use of Foreign Keys for Referential Integrity** - to maintain consistency across related tables.

Example:

The Orders table might have a CustomerID field that is a foreign key referencing the Customers table.

Note that in Oracle database indexes for foreign keys are not created automatically.

4. **Appropriate Data Types** - to use the most suitable data types for each column to optimize storage and performance.

Example:

Use VARCHAR2 for variable-length strings and NUMBER for numerical values in Oracle.

5. **Indexing for Performance** - to improve query performance.

Example:

Creating an index on frequently searched columns, like creating an index on CustomerID in the Orders table.

6. **Avoiding Excessive Normalization (Denormalization)** - to improve performance by reducing the number of joins needed, particularly in read-heavy databases.

Example:

In a reporting database, you might include the customer's name directly in the Orders table to avoid a join with the Customers table.

7. **Using Sequences for Auto-Incrementing Fields** - to generate unique values for primary key fields.

Example:

Creating a sequence for OrderID in the Orders table to ensure each order has a unique identifier.

8. **Implementing Audit Trails** - to keep track of changes for compliance and debugging.

Example:

Having CreatedDate and LastModifiedDate columns in tables to track when records are created and last updated.

9. **Designing for Concurrency** - to allow multiple users to access and modify data concurrently without conflicts.

Example:

Using Oracle's built-in locking mechanisms and designing transactions to be short to reduce locking conflicts.

10. **Consider Partitioning for Large Tables** - to improve performance and manageability for very large tables.

Example:

Partitioning a Sales table by year or region, so queries on a specific year or region are faster.

11. **Consistent Naming Conventions** - to make the schema easier to understand and navigate.

Example:

Prefixing table names with their functional area, like HR_Employees, FIN_Accounts.

12. **Planning for Growth** - to design a scalable database that can handle increased data volume and user load.

Example:

Anticipating future columns and relationships that might be needed and designing tables with flexibility in mind.

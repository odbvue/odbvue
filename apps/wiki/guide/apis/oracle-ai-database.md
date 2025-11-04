# Oracle Autonomous AI Database

## Oracle DB as a Back-end  

### Capabilities

**Oracle Autonomous AI Database** is a next-generation, enterprise-grade database that supports relational, JSON, and NoSQL data models, and not only self-drives, self-secures, and self-repairs by automating tuning, patching, backups, and scaling, but also includes out-of-the-box AI capabilities - such as natural language querying, in-database machine learning, and vector search for generative AI integration - enabling developers and analysts to build and run intelligent, data-driven applications directly within the database.

It supports **SQL** for querying and data manipulation, along with **PL/SQL (Procedural Language/SQL)** - Oracle’s proprietary procedural extension to SQL that enables developers to implement complex business logic directly within the database. **PL/SQL** provides robust programming capabilities, allowing efficient, secure, and high-performance execution of application logic close to the data.

**Oracle REST Data Services (ORDS)** is a mid-tier application that provides a RESTful web service interface for Oracle Database. It allows developers to easily expose database objects as REST APIs without needing to write custom backend code, leveraging Oracle’s authentication, authorization, and security features.

### Full-featured, REST-enabled data platform

**Together, Oracle Database and ORDS** turn the database into a full-featured, REST-enabled data platform for modern application development, combining powerful data management, procedural logic with PL/SQL, and RESTful integration capabilities.

::: details Note on implementing business logic in PL/SQL 
> Using PL/SQL for business logic can be a good idea, but it depends on several factors. Here are some points to consider:
>
> **Advantages**
>
> 1. **Performance**: PL/SQL is processed by the Oracle Database, which can lead to faster execution compared to application server processing, especially for data-intensive operations.
> 2. **Data Integrity**: By encapsulating business logic in the database, you can enforce data integrity and business rules directly where the data resides.
> 3. **Centralization**: Having business logic in PL/SQL centralizes the logic in the database, making it easier to manage and maintain, especially in environments with multiple applications accessing the same database.
> 4. **Reduced Network Traffic**: Since operations are done in the database, there's less need to transfer data back and forth between the application server and the database, which can improve performance for certain types of applications.
>
> **Disadvantages**
>
> 1. **Tight Coupling with Database**: Business logic in PL/SQL ties your application closely to Oracle Database, which can limit flexibility and make it harder to switch databases or use multiple databases.
> 2. **Skill Set Requirements**: Writing and maintaining PL/SQL requires specialized knowledge, which might not be as widely available as skills for other programming languages.
> 3. **Scalability and Load Balancing**: Scaling applications that rely heavily on database-side logic may require additional planning and tuning to ensure performance remains consistent as load increases.
> 4. **Testing and Debugging**: Testing PL/SQL logic can sometimes be less straightforward than testing application-layer code, though modern tools and frameworks have improved this process significantly.
>
> **Disclaimer**
>
> Deciding whether to **implement business logic in PL/SQL** depends on your application’s needs, team expertise, and architecture. When performance, data integrity, and centralized rule enforcement are key, PL/SQL can offer clear advantages comparing to other available options.
>
> ![Note](/favicon.ico)
>
:::

## Common Misconceptions

### Relational database does not scale

If the core of the business is data, the relational data, then database scaling will be needed anyway - no matter if emphasis is on application or database level. In Partitioning and sharding are the keywords to solve this challenge. But you are probably already really lucky and successful if these are the kind of problems you need to solve.

### Not a grip of any logic shall be in database

If that is dogma, then this setup really might be not for you. On the rational side - if business is mainly dealing with data - what could even be a rational reason to select some set of data, then select some other set, bring over to the application, join there, maybe do some little transformation, and then send it back to the database?

### It is not maintainable code

No different from any other code. Syntax is a bit specific and has not changed significantly since.. Nobody remembers. But the old packages will still work, backwards compatibility is truly amazing. Merging sometimes will be less pretty, so again - it is important to keep packages and routines organized and reasonably sized.

### Debugging is a nightmare

Partially true. The same nightmare as galloping through endless .net or java stack traces. On the SQL side the sun is brighter - detecting slow-ish statements is out of the box, however optimization itself requires some decent level of professionalism. From the other side - the amount of effort will be the same wherever your SQL statements reside - in PL SQL package or in application. On PL SQL debugging - key is the same as with any other code - keep it neat and clean and there will be no need to debug.

### It does not version

It surely does. The new SQLcl provides project init and very smooth branching and upgrading strategies. Generated Rest services can be easily versioned. Even further - database objects can be versioned using Oracle Edition Based Redefinition, enabling live migrations.

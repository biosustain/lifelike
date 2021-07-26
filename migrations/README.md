# Migrations

## Table of Contents
* [Why Use Migrations](#why-use-migration)
* [Installation](#installation)
* [How Liquibase Works](#how-liquibase-works)
* [Checking Migration Version Logs](#checking-migration-version-logs)
* [Rolling Back](#rolling-back)
* [Running Migrations](#running-migrations)

## Why Use Migrations
Using migrations allows us to consistently deploy a copy of the current graph model on any server. Without migrations, we have to keep creating a database backup file and download/upload them. This takes a long time because of how large the files are.

It also helps to avoid having to parse data files if people do not want to download the backup files. Because all the data has already been parsed beforehand and transformed into queries in the `changelog.xml` files.

The good thing about using liquibase is if it fails at a step, it will start at that step when you re-run it.

## Installation
Migration uses Liquibase for Neo4j (https://neo4j.com/labs/liquibase/):
- https://github.com/liquibase/liquibase-neo4j

To get started, install the liquibase CLI based on your operating system: https://docs.liquibase.com/concepts/installation/home.html
- For MACs, you can also install with `homebrew` (https://brew.sh/) with the command: `brew install liquibase`.

Once installed, you need to set the `LIQUIBASE_HOME` path. If you used homebrew, it will tell you:
```bash
You should set the environment variable LIQUIBASE_HOME to
  /usr/local/opt/liquibase/libexec
```

You will also need the Java JDK (version 8+). Again, if you're on MACs, you can use `brew install openjdk@<version>`. To see the available versions do `brew list`.

Run the command below to confirm the liquibase CLI is installed.

```bash
> liquibase -version
####################################################
##   _     _             _ _                      ##
##  | |   (_)           (_) |                     ##
##  | |    _  __ _ _   _ _| |__   __ _ ___  ___   ##
##  | |   | |/ _` | | | | | '_ \ / _` / __|/ _ \  ##
##  | |___| | (_| | |_| | | |_) | (_| \__ \  __/  ##
##  \_____/_|\__, |\__,_|_|_.__/ \__,_|___/\___|  ##
##              | |                               ##
##              |_|                               ##
##                                                ## 
##  Get documentation at docs.liquibase.com       ##
##  Get certified courses at learn.liquibase.com  ## 
##  Free schema change activity reports at        ##
##      https://hub.liquibase.com                 ##
##                                                ##
####################################################
Starting Liquibase at 15:30:24 (version 4.4.1 #29 built at 2021-07-09 16:46+0000)
Running Java under /usr/local/Cellar/openjdk/16.0.1/libexec/openjdk.jdk/Contents/Home (Version 16.0.1)

Liquibase Version: 4.4.1
Liquibase Community 4.4.1 by Datical
```

### JAR Files
You will need two `.jar` files for liquibase to work:
- liquibase-neo4j: https://github.com/liquibase/liquibase-neo4j/releases
- Neo4j JDBC: https://github.com/neo4j-contrib/neo4j-jdbc/releases
    - Update 7/23/2021: Check out the 4.0 branch and build it instead.
    - The reason is because a bug fix (about frozen return queries) was merged but hasn't been released yet.
    - Run `mvn package -DskipTest` and copy the `target/neo4j-jdbc-driver-4.0.1.jar` file.
    - Note: The `mvn` (maven) should have been installed along with the OpenJDK.

Download them based on the neo4j version, e.g 4.x `.jars` for our neo4j. Put them in the `$LIQUIBASE_HOME/lib` folder location.

```bash
> pwd
/usr/local/opt/liquibase/libexec/lib
> ls -lt
total 27112
-rw-r--r--@ 1 ...  9466290 Jul 20 13:54 neo4j-jdbc-driver-4.0.1.jar
-rw-r--r--@ 1 ...    25536 Jul 20 13:52 liquibase-neo4j-4.4.1.jar
-rw-r--r--  1 ...  2303679 Jul  9 09:50 h2-1.4.200.jar
-rw-r--r--  1 ...   125632 Jul  9 09:50 jaxb-api-2.3.0.jar
-rw-r--r--  1 ...   255502 Jul  9 09:50 jaxb-core-2.3.0.jar
-rw-r--r--  1 ...   963660 Jul  9 09:50 jaxb-impl-2.3.0.jar
-rw-r--r--  1 ...     3225 Jul  9 09:50 liquibase_autocomplete.sh
-rw-r--r--  1 ...     2578 Jul  9 09:50 liquibase_autocomplete_mac.bash
-rw-r--r--  1 ...   402057 Jul  9 09:50 picocli-4.6.1.jar
-rw-r--r--  1 ...   310104 Jul  9 09:50 snakeyaml-1.27.jar
```

## How Liquibase Works
Liquibase uses `.xml`, `.json` etc files to do its migrations. We will use `.xml` since it's most common.

The `migrations/changelog-master.xml` is the entry point that liquibase uses, think of it as the initial migration version. In that file, it sets `<includeAll>` which tells liquibase where to look for all changelog files. The files in this folder are ran **ALPHABETICALLY**.

**IMPORTANT**: The files in `changelogs` are ran **ALPHABETICALLY**.

What this means is we have to be careful of how we name our files.

- changelog-1.0.xml
- changelog-10.0.xml
- changelog-2.0.xml

The above order, `changelog-10.0.xml` will run **before** `changelog-2.0.xml`. Obviously this is not what we want (since 10 comes after 2), we will need some sort of convention here.

- changelog-0010.xml
- changelog-0020.xml
- changelog-0030.xml
- changelog-0200.xml

We will increment by 10s, as this should allow us to increment alphabetically up to 1000, 1010, 1020, etc...

The simplest changeset `.xml` should be something like this:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
  xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:pro="http://www.liquibase.org/xml/ns/pro"
  xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.8.xsd http://www.liquibase.org/xml/ns/pro http://www.liquibase.org/xml/ns/pro/liquibase-pro-3.8.xsd">
  <changeSet id="<JIRA_number>" author="<name>">
    <comment>Testing create query</comment>
    <sql>CREATE (:FOO {name: 'Foo'})</sql>
  </changeSet>
  <changeSet id="<JIRA_number>" author="<name>">
    <!-- more queries -->
  </changeSet>
</databaseChangeLog>
```
Both `id` and `author` are required.

**IMPORTANT NOTE**: Each `changeSet` represents a transaction, neo4j does not allow changing the schema (dropping an index, etc) and a write query in the same transaction, otherwise you will get the error `Tried to execute Write query after executing Schema modification`. This means you will need two `changeSet`, so group them together using the `id="some text-#"` naming convention. (See for more info: https://stackoverflow.com/a/56705198).

**IMPORTANT**: Each `changeSet` can only have **one** `<sql>` tag, to run multiple queries, you separate each with a semi-colon "`;`" and set `<sql splitStatements="true">` (splitStatements is true by default). If you have multiple `<sql>` tags in one change set, it will create a deadlock in the database and never finish.

```xml
<!--
  correct, but seems to have its own issues
  better to just have one query in a <sql>

  a changeset is like a transaction
-->
<changeSet>
  <comment>Testing create query</comment>
  <sql>
    CREATE (:Foo {name: 'Foo'});
    CREATE (:Foo {name: 'Foo Boo'});
  </sql>
</changeSet>
```

As you can see, the `<sql>` tag is where the cypher query is placed. This works for "simple" queries. But if we need to parse a data file and write many queries, we might need to write a separate script and programmatically create the `.xml` file to place into `changelogs/`.
- can consider using https://docs.python.org/3/library/xml.etree.elementtree.html

More information can be found: https://docs.liquibase.com/concepts/home.html

## Checking Migration Version Logs
Liquibase will create node labels in the database, two of them include: `__LiquibaseChangeLog` and `__LiquibaseChangeSet`.
- `__LiquibaseChangeLog`: when the database was last updated and the related changelog files.
- `__LiquibaseChangeSet`: the migration version chain (or changesets) associated with the changelog files.

## Rolling Back
Liquibase handles rolling back automatically if there is an error: https://docs.liquibase.com/concepts/basic/changeset.html

> Liquibase attempts to execute each changeset in a transaction that is committed at the end, or rolled back if there is an error. Some databases will auto-commit statements which interferes with this transaction setup and could lead to an unexpected database state. Therefore, it is best practice to have just one change per changeset unless there is a group of non-auto-committing changes that you want to apply as a transaction such as inserting data.
  - Again, see for more info: https://stackoverflow.com/a/56705198

However, if you prefer to rollback manually, you can do so...

Before running migrations, you can tag the current state of the database so if the migration fails, you can rollback.
```bash
liquibase tag "some text description" --url jdbc:neo4j:bolt://<ip_address> --username <db_name> --password <db_pass>

liquibase rollback "some text description" --url jdbc:neo4j:bolt://<ip_address> --username <db_name> --password <db_pass> --changeLogFile migrations/changelog-master.xml
```

## Running Migrations
There are two commands you can use. The first time you run these commands, you will see a prompt:
```bash
Do you want to see this operation's report in Liquibase Hub, which improves team collaboration? 
If so, enter your email. If not, enter [N] to no longer be prompted, or [S] to skip for now, but ask again next time (default "S"):
```
Simply enter `N` and continue.

```bash
# don't need port in ip address
liquibase --url jdbc:neo4j:bolt://<ip_address> --username <db_name> --password <db_pass> --changeLogFile migrations/changelog-master.xml updateSQL
```
This command (dry run) will give you a preview of what liquibase will run. You can use this command to **make sure the changelog files are going to execute in order**.

```bash
# don't need port in ip address
# --log-level is optional
liquibase --log-level=info --url jdbc:neo4j:bolt://<ip_address> --username <db_name> --password <db_pass> --changeLogFile migrations/changelog-master.xml update
```
This command will run the queries and update the database.

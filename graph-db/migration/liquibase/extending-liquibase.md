# Extending Liquibase
It is possible to extend Liquibase, we currently do this, some examples include: `FileQueryHandler.java` and `ConditionQueryHandler.java`. Future extension can choose to implement from `CustomTaskChange` like these two did, or extend from the query handler classes directly.

## Properties File
```properties
# properties used by liquibase command line
changeLogFile=new-***ARANGO_DB_NAME***-graph/changelog-master.xml
url=jdbc:neo4j:bolt://localhost?database=neo4j
username=neo4j
password=password

# properties used as parameters by *Handler.java classes in liquibase changelog.xml
parameter.neo4jHost=bolt://localhost
# separate credentials by comma; username first: <username>,<password>
parameter.neo4jCredentials=neo4j,password
parameter.neo4jDatabase=neo4j
parameter.azureStorageName=
parameter.azureStorageKey=
parameter.localSaveFileDir=

liquibase.hub.mode=off
```
The `parameter.localSaveFileDir` is where the `FileQueryHandler` will download the files from Azure to *if the files do not exist* in that folder. It is also where it will read from when it starts seeding data to Neo4j. This means we can completely remove the cloud storage properties if we only keep the data files locally.

If we want to be generic in terms of the name, we can use something like `parameter.cloudStorageName` instead. But keep in mind that because Liquibase creates a checksum from these properties, changing them directly will cause a validation error in the checksum (because it compares with the previously saved checksum), and potentially force Liquibase to re-run the specific changelog. **This only applies to if we have already ran Liquibase. If we haven't then we do not need to worry!**

Alternatively, we can also go the environment variables approach. This was the preferred original way, but was changed to use properties files to accommodate other developers working locally only.

## For Open Source
If we are making a new repository for the open source, we can copy over some files. The Liquibase code was originally intended for internal use, so we don't want to put those out. Instead, we can copy specific Java files and with instructions for people to implement/extend and use what we give as an example. The `FileContent.java`, `FileReader.java` and `FileQueryHandler.java` can be copied over (but the later will need to be modified to not have `"Azure"` in the property names etc). Also any cloud storage and Neo4j classes, e.g `liquibase-src/src/main/java/edu/ucsd/sbrg/neo4j` and `liquibase-src/src/main/java/edu/ucsd/sbrg/storage`.

Again, these files need to be modified slightly so people can use them as an example.

## Combine ETL With Liquibase
Currently our process to seed Neo4j involves two steps:
1. Produce `.tsv` data files
2. Liquibase retrieve those data files and seed Neo4j

These two are separate because we decided to not re-write the Python scripts into Java. Additionally, we wanted a record trail to know what was inserted into our graph, before we had no such thing and it was difficult to figure out. Based on these requirements, the data files are stored in Azure.

In the future, we can potentially have Liquibase call the Python scripts directly. Of course this means we need to include them in the docker image, right now only the Liquibase changelogs and JARs are included.

For how the parsing is done, or how to run the parser, see `graph-db/extraction/README.md`.

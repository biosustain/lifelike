package edu.ucsd.sbrg.liquibase.neo4j;

import edu.ucsd.sbrg.liquibase.neo4j.cloudstorage.AzureCloudStorage;

import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.neo4j.driver.Session;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class FileQueryHandler implements CustomTaskChange {
    private Driver driver;
    private String query;
    private String fileName;
    private int startAt;
    private ResourceAccessor resourceAccessor;
    private AzureCloudStorage cloudStorage;

    public FileQueryHandler() {
        this.cloudStorage = new AzureCloudStorage(
                System.getenv("AZURE_ACCOUNT_STORAGE_NAME"),
                System.getenv("AZURE_ACCOUNT_STORAGE_KEY"),
                System.getenv("HOME"));
    }

    public String getQuery() {
        return this.query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getFileName() {
        return this.fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public int getStartAt() {
        return this.startAt;
    }

    public void setStartAt(String startAt) {
        this.startAt = Integer.parseInt(startAt);
    }

//    public String getShareName() {
//        return this.shareName;
//    }
//
//    public void setShareName(String shareName) {
//        this.shareName = shareName;
//    }

    public void setDatabaseDriver(String uri, String user, String password) {
        this.driver = GraphDatabase.driver(uri, AuthTokens.basic(user, password));
    }

    @Override
    public void execute(Database database) {
        // TODO: temp way to get database credentials
        // need to figure out how to get credentials from liquibase
        final String host = System.getenv("NEO4J_INSTANCE_URI");
        final String username = System.getenv("NEO4J_USERNAME");
        final String password = System.getenv("NEO4J_PWD");

        System.out.println("Executing query: " + this.getQuery());

        this.setDatabaseDriver(host, username, password);

        try {
            this.cloudStorage.writeToFile((ByteArrayOutputStream) this.cloudStorage.download(this.getFileName()));
        } catch (IOException e) {
            e.printStackTrace();
            System.exit(1);
        }

        List<String[]> content;
        try {
            String tsvFilePath = this.cloudStorage.getLocalSaveDir() + "/" + this.fileName.substring(0, this.fileName.lastIndexOf(".")) + ".tsv";
            System.out.println("tsvFilePath " + tsvFilePath);
            content = Files.lines(Paths.get(tsvFilePath))
                    // skip header
                    .skip(1).map(line -> line.split("\t")).collect(Collectors.toList());

            final int chunk = 5000;
            int start = this.getStartAt();
            System.out.println("startAt " + start);
            int end = chunk;
            int processed = 1;

//            UNWIND $rows AS row
//            MATCH (n) WHERE id(n) = row.node_id[0]
//            SET n.original_entity_types = row.entity_types

            while (end <= content.size() + chunk) {
                Map<String, String[]> params = new HashMap<>();
                content.stream().skip(start).limit(end - start).forEach(row -> {
                    params.put("node_id", row[0].split(","));
                    params.put("entity_types", row[1].split(","));
                });
                processed += end;
                start = processed - 1;
                end += chunk;

                try (Session session = this.driver.session()) {
                    System.out.println("Inside try/catch session.");
                } catch (Exception e) {
                    System.out.println("Encountered error! Processed " + processed + " lines before error occurred...");
                    throw new CustomChangeException(e);
                }

            }
        } catch (IOException | CustomChangeException e) {
            e.printStackTrace();
            System.exit(1);
        }
    }

    @Override
    public String getConfirmationMessage() {
        return "Working";
    }

    @Override
    public void setUp() throws SetupException { }

    @Override
    public void setFileOpener(ResourceAccessor resourceAccessor) {
        this.resourceAccessor = resourceAccessor;
    }

    @Override
    public ValidationErrors validate(Database database) {
        return new ValidationErrors();
    }
}

package edu.ucsd.sbrg.liquibase;

import edu.ucsd.sbrg.liquibase.extract.FileExtract;
import edu.ucsd.sbrg.liquibase.extract.FileExtractFactory;
import edu.ucsd.sbrg.liquibase.extract.FileType;
import edu.ucsd.sbrg.liquibase.storage.AzureCloudStorage;

import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.GraphDatabase;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import static org.neo4j.driver.Values.parameters;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

public class FileQueryHandler implements CustomTaskChange {
    private Driver driver;
    private String query;
    private String fileName;
    private int startAt;
    private ResourceAccessor resourceAccessor;

    public FileQueryHandler() { }

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
    public void execute(Database database) throws CustomChangeException {
        // TODO: temp way to get database credentials
        // need to figure out how to get credentials from liquibase
        final String neo4jHost = System.getenv("NEO4J_INSTANCE_URI");
        final String neo4JUsername = System.getenv("NEO4J_USERNAME");
        final String neo4jPassword = System.getenv("NEO4J_PWD");
        final String azureStorageName = System.getenv("AZURE_ACCOUNT_STORAGE_NAME");
        final String azureStorageKey = System.getenv("AZURE_ACCOUNT_STORAGE_KEY");
        final String azureSaveFileDir = System.getenv("HOME");

        System.out.println("Executing query: " + this.getQuery());

        this.setDatabaseDriver(neo4jHost, neo4JUsername, neo4jPassword);

        AzureCloudStorage cloudStorage = new AzureCloudStorage(azureStorageName, azureStorageKey);
        FileExtract fileExtract = new FileExtractFactory(FileType.valueOf("TSV")).getInstance(this.fileName, azureSaveFileDir);

        List<String[]> content = null;
        try {
            cloudStorage.writeToFile((ByteArrayOutputStream) cloudStorage.download(this.getFileName()), azureSaveFileDir);
            content = fileExtract.getFileContent();
        } catch (IOException e) {
            e.printStackTrace();
            System.exit(1);
        }

        final int chunkSize = 5000;

        List<List<Map<String, String[]>>> chunkedCypherParams = new ArrayList<>();
        AtomicInteger counter = new AtomicInteger();
        final Collection<List<String[]>> chunkedContent = content.stream()
                .collect(Collectors.groupingBy(i -> counter.getAndIncrement() / chunkSize)).values();

        chunkedContent.stream().skip(this.getStartAt()).forEach(contentChunk -> {
            List<Map<String, String[]>> cypherParamsChunk = new ArrayList<>();
            contentChunk.forEach(row -> {
                Map<String, String[]> param = new HashMap<>();
                param.put("node_id", row[0].split(","));
                param.put("entity_types", row[1].split(","));
                cypherParamsChunk.add(param);
            });
            chunkedCypherParams.add(cypherParamsChunk);
        });

        final int[] processed = {0};
        try (Session session = this.driver.session()) {
            chunkedCypherParams.forEach(paramChunk -> {
                session.writeTransaction(tx -> tx.run(this.getQuery(), parameters("rows", paramChunk)));
                processed[0] += + paramChunk.size();
            });
        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("Encountered error! Processed " + processed[0] + " lines before error occurred...");
            throw new CustomChangeException();
        }

        // TODO: delete file once done
        // TODO: extract neo4j into a class
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

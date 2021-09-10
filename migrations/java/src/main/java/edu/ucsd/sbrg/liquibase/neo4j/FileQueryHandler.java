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

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStreamReader;
import java.io.IOException;
import java.util.zip.ZipInputStream;

public class FileQueryHandler implements CustomTaskChange {
    private Driver driver;
    private String query;
    private String fileName;
    private String shareName;
    private ResourceAccessor resourceAccessor;
    private AzureCloudStorage cloudStorage;

    public FileQueryHandler() {
        this.cloudStorage = new AzureCloudStorage(
                System.getenv("AZURE_ACCOUNT_STORAGE_NAME"),
                System.getenv("AZURE_ACCOUNT_STORAGE_KEY"));
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

    public String getShareName() {
        return this.shareName;
    }

    public void setShareName(String shareName) {
        this.shareName = shareName;
    }

    public void setDatabaseDriver(String uri, String user, String password) {
        this.driver = GraphDatabase.driver(uri, AuthTokens.basic(user, password));
    }

    @Override
    public void execute(Database database) throws CustomChangeException {
        // TODO: temp way to get database credentials
        // need to figure out how to get credentials from liquibase
        final String host = System.getenv("NEO4J_INSTANCE_URI");
        final String username = System.getenv("NEO4J_USERNAME");
        final String password = System.getenv("NEO4J_PWD");

        System.out.println("Executing query: " + this.getQuery());

        this.setDatabaseDriver(host, username, password);

        this.cloudStorage.setShareName(this.getShareName());
        ByteArrayOutputStream bao = (ByteArrayOutputStream) this.cloudStorage.download(this.getFileName());
        ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bao.toByteArray()));
        BufferedReader reader = new BufferedReader(new InputStreamReader(zip));
        try {
            // skip header line
            reader.readLine();
            String line;
            while((line = reader.readLine()) != null) {
                System.out.println(line);
            }
        } catch (IOException ex) {
            ex.printStackTrace();
            throw new CustomChangeException("Failed to read the data file!");
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

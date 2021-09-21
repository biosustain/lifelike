package edu.ucsd.sbrg.liquibase;

import edu.ucsd.sbrg.liquibase.extract.FileExtract;
import edu.ucsd.sbrg.liquibase.extract.FileExtractFactory;
import edu.ucsd.sbrg.liquibase.extract.FileType;
import edu.ucsd.sbrg.liquibase.neo4j.Neo4jGraph;
import edu.ucsd.sbrg.liquibase.storage.AzureCloudStorage;

import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

/**
 * <changeSet id="..." author="...">
 *     <comment>...</comment>
 *     <customChange
 *       class="edu.ucsd.sbrg.liquibase.FileQueryHandler"
 *       query="..."
 *       fileName="<filename>.zip"
 *       startAt="1"
 *       fileType="TSV"
 *       neo4jHost="${neo4jHost}"
 *       neo4jUsername="${neo4jUsername}"  -> these ${} are parameters set in liquibase.properties
 *       neo4jPassword="${neo4jPassword}"
 *       neo4jDatabase="${neo4jDatabase}"
 *       azureStorageName="${azureStorageName}"
 *       azureStorageKey="${azureStorageKey}"
 *       azureSaveFileDir="${azureSaveFileDir}"/>
 * </changeSet>
 *
 * query: the cypher query to be executed.
 * fileName: the data file (ZIP) on Azure to download and use.
 * startAt: the starting index (default should be 1 to skip header line) for the data processing.
 *          headers are not included, so first data line is zero.
 * fileType: the type of file within the zip (e.g CSV, TSV, etc...).
 */
public class FileQueryHandler implements CustomTaskChange {
    private String query;
    private String fileName;
    private String fileType;
    private int startAt;
    private ResourceAccessor resourceAccessor;
    static final Logger logger = LogManager.getLogger(FileQueryHandler.class);

    private String neo4jHost;
    private String neo4jUsername;
    private String neo4jPassword;
    private String neo4jDatabase;
    private String azureStorageName;
    private String azureStorageKey;
    private String azureSaveFileDir;

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

    public String getFileType() {
        return this.fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public int getStartAt() {
        return this.startAt;
    }

    public void setStartAt(String startAt) {
        this.startAt = Integer.parseInt(startAt);
    }

    public String getNeo4jHost() {
        return this.neo4jHost;
    }

    public void setNeo4jHost(String neo4jHost) {
        this.neo4jHost = neo4jHost;
    }

    public String getNeo4jUsername() {
        return this.neo4jUsername;
    }

    public String getNeo4jPassword() {
        return this.neo4jPassword;
    }

    public void setNeo4jCredentials(String neo4jCredentials) {
        String[] creds = neo4jCredentials.split(",");
        this.neo4jUsername = creds[0];
        this.neo4jPassword = creds[1];
    }

    public String getNeo4jDatabase() {
        return this.neo4jDatabase;
    }

    public void setNeo4jDatabase(String neo4jDatabase) {
        this.neo4jDatabase = neo4jDatabase;
    }

    public String getAzureStorageName() {
        return this.azureStorageName;
    }

    public void setAzureStorageName(String azureStorageName) {
        this.azureStorageName = azureStorageName;
    }

    public String getAzureStorageKey() {
        return this.azureStorageKey;
    }

    public void setAzureStorageKey(String azureStorageKey) {
        this.azureStorageKey = azureStorageKey;
    }

    public String getAzureSaveFileDir() {
        return this.azureSaveFileDir;
    }

    public void setAzureSaveFileDir(String azureSaveFileDir) {
        this.azureSaveFileDir = azureSaveFileDir;
    }

    @Override
    public void execute(Database database) throws CustomChangeException {
        AzureCloudStorage cloudStorage = new AzureCloudStorage(this.getAzureStorageName(), this.getAzureStorageKey());
        FileExtract fileExtract = new FileExtractFactory(FileType.valueOf(this.getFileType())).getInstance(this.getFileName(), this.getAzureSaveFileDir());
        Neo4jGraph graph = new Neo4jGraph(this.getNeo4jHost(), this.getNeo4jUsername(), this.getNeo4jPassword(), this.getNeo4jDatabase());

        List<String[]> content = new ArrayList<>();
        final int chunkSize = 5000;
        int processed = 0;
        int skipCount = 0;
        String lastProcessedLine = null;
        String[] header = null;
        try {
            logger.info("Downloading file " + this.getFileName() + " from Azure Cloud.");
            cloudStorage.writeToFile((ByteArrayOutputStream) cloudStorage.download(this.getFileName()), this.getAzureSaveFileDir());
//            content = fileExtract.getFileContent();
            FileInputStream input = new FileInputStream(fileExtract.getFilePath());
            Scanner sc = new Scanner(input);
            while (sc.hasNextLine()) {
                String currentLine = sc.nextLine();
                logger.debug("Read line '" + currentLine + "' from file.");
                if (header == null) {
                    header = currentLine.split(fileExtract.getDelimiter());
                    skipCount++;
                } else {
                    if (skipCount != this.getStartAt()) {
                        skipCount++;
                    } else {
                        if ((content.size() > 0 && (content.size() % (chunkSize * 4) == 0))) {
                            try {
                                graph.execute(this.getQuery(), content, header, chunkSize);
                            } catch (CustomChangeException ce) {
                                ce.printStackTrace();
                                String output = "Encountered error! Set startAt to line " +
                                        (processed + 1) + " (last value processed in file: " + lastProcessedLine +
                                        ") to pick up where left off.";
                                logger.error(output);
                                throw new CustomChangeException();
                            }
                            processed += content.size();
                            lastProcessedLine = Arrays.toString(content.get(content.size() - 1));
                            content.clear();
                        } else {
                            content.add(currentLine.split(fileExtract.getDelimiter()));
                        }
                    }
                }
            }

            input.close();
            sc.close();

            // wrap up any leftovers in content
            // since file could be smaller than chunkSize * 4
            if (content.size() > 0) {
                try {
                    graph.execute(this.getQuery(), content, header, chunkSize);
                    processed += content.size();
                    lastProcessedLine = Arrays.toString(content.get(content.size() - 1));
                    content.clear();
                } catch (CustomChangeException ce) {
                    ce.printStackTrace();
                    String output = "Encountered error! Set startAt to line " +
                            (processed + 1) + " (last value processed in file: " + lastProcessedLine +
                            ") to pick up where left off.";
                    logger.error(output);
                    throw new CustomChangeException();
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
            System.exit(1);
        }

        new File(fileExtract.getFilePath()).delete();
        graph.getDriver().close();
    }

    @Override
    public String getConfirmationMessage() {
        return "Working";
    }

    @Override
    public void setUp() throws SetupException {
        // Any setup steps go here
        // Liquibase calls before execute()
    }

    @Override
    public void setFileOpener(ResourceAccessor resourceAccessor) {
        this.resourceAccessor = resourceAccessor;
    }

    @Override
    public ValidationErrors validate(Database database) {
        return new ValidationErrors();
    }
}

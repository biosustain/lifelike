package edu.ucsd.sbrg;

import edu.ucsd.sbrg.neo4j.Neo4jGraph;

import edu.ucsd.sbrg.storage.AzureCloudStorage;
import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Enumeration;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;
import java.util.zip.*;

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
 *       neo4jCredentials="${neo4jCredentials}"  -> these ${} are parameters set in liquibase.properties
 *       neo4jDatabase="${neo4jDatabase}"
 *       localSaveFileDir="${localSaveFileDir}"/>
 * </changeSet>
 *
 * query: the cypher query to be executed.
 * fileName: the data file (ZIP) on Azure to download and use.
 * startAt: the starting index (default should be 1 to skip header line) for the data processing.
 *          headers are not included, so first data line is zero.
 * fileType: the type of file within the zip (e.g CSV, TSV, etc...).
 */
public class ZipFileQueryHandler implements CustomTaskChange {
    static final String DELIMITER = "\t";

    private String query;
    private String fileName;
    private String zipFileName;
    private int startAt;
    private ResourceAccessor resourceAccessor;
    static final Logger logger = LogManager.getLogger(FileQueryHandler.class);

    private String neo4jHost;
    private String neo4jCredentials;
    private String neo4jDatabase;
    private String azureStorageName;
    private String azureStorageKey;
    private String localSaveFileDir;

    public ZipFileQueryHandler() { }

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

    public String getZipFileName() {return this.zipFileName; }

    public void setZipFileName(String zipFileName) {this.zipFileName = zipFileName; }

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

    public String getNeo4jCredentials() {
        return this.neo4jCredentials;
    }

    public void setNeo4jCredentials(String neo4jCredentials) {
        this.neo4jCredentials = neo4jCredentials;
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

    public String getLocalSaveFileDir() {
        return this.localSaveFileDir;
    }

    public void setLocalSaveFileDir(String localSaveFileDir) {
        this.localSaveFileDir = localSaveFileDir;
    }

    @Override
    public void execute(Database database) throws CustomChangeException {
        Neo4jGraph graph = new Neo4jGraph(this.getNeo4jHost(), this.getNeo4jCredentials(), this.getNeo4jDatabase());

        String[] header = null;
        try {
            if (this.getZipFileName() != null) {
                String filepath = this.getLocalSaveFileDir() + "/" + this.getZipFileName();
                if (!Files.exists(Paths.get(filepath))) {
                    // download file from cloud
                    System.out.println("Downloading file " + this.getZipFileName() + " from Azuer cloud.");
                    AzureCloudStorage cloudStorage = new AzureCloudStorage(this.getAzureStorageName(), this.getAzureStorageKey());
                    cloudStorage.downloadToFile(this.zipFileName, this.localSaveFileDir, false);
                }
                ZipFile zipFile = new ZipFile(filepath);
                Enumeration<? extends ZipEntry> entries = zipFile.entries();
                while (entries.hasMoreElements()) {
                    ZipEntry entry = entries.nextElement();
                    String name = entry.getName();
                    if (name.equals(this.getFileName())) {
                        logger.info("load file " + name);
                        InputStream input = zipFile.getInputStream(entry);
                        processInput(input, graph);
                        input.close();
                        break;
                    }
                }
                zipFile.close();
            }
            else {
                System.out.print("cannot find zip file");
            }
        } catch (IOException e) {
            e.printStackTrace();
            System.exit(1);
        }
        graph.getDriver().close();
    }

    private void processInput(InputStream input, Neo4jGraph graph) throws CustomChangeException{
        List<String[]> content = new ArrayList<>();
        final int chunkSize = 5000;
        int processed = 0;
        int skipCount = 0;
        String lastProcessedLine = null;
        String[] header = null;
        Scanner sc = new Scanner(input);
        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            logger.debug("Read line '" + currentLine + "' from file.");
            if (header == null) {
                header = currentLine.split(DELIMITER, -1);
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
                    }
                    content.add(currentLine.split(DELIMITER, -1));
                }
            }
        }
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

    public static void main(String[] args){
        ZipFileQueryHandler handler = new ZipFileQueryHandler();
        handler.setNeo4jCredentials("neo4j,rcai");
        handler.setNeo4jHost("bolt://localhost");
        handler.setNeo4jDatabase("test");
        handler.setLocalSaveFileDir("/Users/rcai/data/processed");
        handler.setZipFileName("jira-LL-3213-go-data.zip");
//        handler.setFileName("jira-LL-3213-go-data.zip");
        handler.setStartAt("1");
        handler.setAzureStorageName("***ARANGO_DB_NAME***");
        handler.setAzureStorageKey("***AZURE_ACCOUNT_STORAGE_KEY***");
        try {
            handler.execute(null);
        }
        catch(Exception ex) {
            ex.printStackTrace();
        }
    }
}

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
 *       fileType="TSV"/>
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

    @Override
    public void execute(Database database) throws CustomChangeException {
        // TODO: temp way to get database credentials
        // need to figure out how to get credentials from liquibase
        final String neo4jHost = System.getenv("NEO4J_INSTANCE_URI");
        final String neo4jUsername = System.getenv("NEO4J_USERNAME");
        final String neo4jPassword = System.getenv("NEO4J_PWD");
        final String azureStorageName = System.getenv("AZURE_ACCOUNT_STORAGE_NAME");
        final String azureStorageKey = System.getenv("AZURE_ACCOUNT_STORAGE_KEY");
        final String azureSaveFileDir = System.getenv("HOME");

        AzureCloudStorage cloudStorage = new AzureCloudStorage(azureStorageName, azureStorageKey);
        FileExtract fileExtract = new FileExtractFactory(FileType.valueOf(this.getFileType())).getInstance(this.fileName, azureSaveFileDir);
        Neo4jGraph graph = new Neo4jGraph(neo4jHost, neo4jUsername, neo4jPassword);

        List<String[]> content = new ArrayList<>();
        final int chunkSize = 5000;
        int processed = 0;
        int skipCount = 0;
        String lastProcessedLine = null;
        String[] header = null;
        try {
            logger.info("Downloading file " + this.getFileName() + " from Azure Cloud.");
            cloudStorage.writeToFile((ByteArrayOutputStream) cloudStorage.download(this.getFileName()), azureSaveFileDir);
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

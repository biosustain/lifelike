package edu.ucsd.sbrg;

import edu.ucsd.sbrg.extract.FileExtract;
import edu.ucsd.sbrg.extract.FileExtractFactory;
import edu.ucsd.sbrg.extract.FileType;
import edu.ucsd.sbrg.neo4j.Neo4jGraph;
import edu.ucsd.sbrg.storage.AzureCloudStorage;
import liquibase.database.Database;
import liquibase.exception.CustomChangeException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;

/**
 * <changeSet id="..." author="...">
 *     <comment>...</comment>
 *     <customChange
 *       class="edu.ucsd.sbrg.liquibase.FileQueryHandler"
 *       query="..."
 *       zipFileName="<filename>.zip"
 *       fileName="<filename>.tsv"
 *       startAt="1"
 *       fileType="TSV"
 *       neo4jHost="${neo4jHost}"
 *       neo4jCredentials="${neo4jCredentials}"  -> these ${} are parameters set in liquibase.properties
 *       neo4jDatabase="${neo4jDatabase}"
 *       azureStorageName="${azureStorageName}"
 *       azureStorageKey="${azureStorageKey}"
 *       localSaveFileDir="${localSaveFileDir}"/>
 * </changeSet>
 *
 * query: the cypher query to be executed.
 * zipFileName: the data file (ZIP) on Azure to download and use.
 * fileName: the data file inside zipFileName to use.
 * startAt: the starting index (default should be 1 to skip header line) for the data processing.
 *          headers are not included, so first data line is zero.
 * fileType: the type of file within the zip (e.g CSV, TSV, etc...).
 */
public class ZipFileQueryHandler extends FileQueryHandler {
    private String zipFileName;

    public String getZipFileName() {
        return zipFileName;
    }

    public void setZipFileName(String zipFileName) {
        this.zipFileName = zipFileName;
    }

    @Override
    public void execute(Database database) throws CustomChangeException {
        AzureCloudStorage cloudStorage = new AzureCloudStorage(this.getAzureStorageName(), this.getAzureStorageKey());
        FileExtract fileExtract = new FileExtractFactory(FileType.valueOf(this.getFileType())).getInstance(this.getZipFileName(), this.getLocalSaveFileDir());
        Neo4jGraph graph = new Neo4jGraph(this.getNeo4jHost(), this.getNeo4jCredentials(), this.getNeo4jDatabase());

        List<String[]> content;
        final int chunkSize = 5000;
        int processed = 0;
        String lastProcessedLine = null;
        String[] header;
        try {
            if (!Files.exists(Paths.get(fileExtract.getFilePath()))) {
                // we need to check for prefix because sometimes
                // the data is different from different environments
                // and we need to consider that, e.g drop specific nodes
                String prefix = System.getenv("NEO4J_ENV").equals("QA") || System.getenv("NEO4J_ENV").equals("Staging") ? "stage" : "prod";
                String prefixName = prefix + "-" +  fileExtract.getFileName();
                if (cloudStorage.fileExists(prefixName)) {
                    fileExtract.setFileName(prefixName);
                }
                System.out.println("Downloading file " + fileExtract.getFileName() + " from Azure Cloud.");
                cloudStorage.downloadToFile(fileExtract.getFileName(), fileExtract.getFileDir());
                System.out.println("Finished downloading file " + fileExtract.getFileName() + " from Azure Cloud.");
            }

            FileContent fileContent = new FileReader().readFile(
                    this.getLocalSaveFileDir() + "/" + this.getFileName(), fileExtract.getDelimiter(), this.getStartAt());
            header = fileContent.getHeader();
            while (!fileContent.getContent().isEmpty()) {
                content = fileContent.getContent().remove();
                try {
                    graph.execute(this.getQuery(), content, header, chunkSize);
                } catch (CustomChangeException ce) {
                    ce.printStackTrace();
                    String output = "Encountered error! Set startAt to line " +
                            (processed + 1) + " (last value processed in file: " + lastProcessedLine +
                            ") to pick up where left off.";
                    System.out.println(output);
                    throw new CustomChangeException();
                }
                processed += content.size();
                lastProcessedLine = Arrays.toString(content.get(content.size() - 1));
            }
        } catch (IOException e) {
            e.printStackTrace();
            System.exit(1);
        }

        graph.getDriver().close();
    }
}

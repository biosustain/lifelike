package edu.ucsd.sbrg.storage;

import com.azure.core.util.Context;
import com.azure.storage.file.share.ShareDirectoryClient;
import com.azure.storage.file.share.ShareFileClient;
import com.azure.storage.file.share.ShareFileClientBuilder;
import com.azure.storage.file.share.models.ShareFileRange;
import edu.ucsd.sbrg.extract.FileExtract;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.time.Duration;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipInputStream;

public class AzureCloudStorage extends CloudStorage {
    ShareDirectoryClient storageClient;
    static final String CLOUD_SHARE_NAME = "knowledge-graph";
    static final String CLOUD_FILE_DIR = "migration";

    public AzureCloudStorage(String storageAccountName, String storageAccountKey) {
        this.connectionString = "DefaultEndpointsProtocol=https;" +
                "AccountName=" + storageAccountName + ";" +
                "AccountKey=" + storageAccountKey;
    }

    private ShareDirectoryClient initStorageClient() {
        this.storageClient = new ShareFileClientBuilder().connectionString(this.connectionString)
                .shareName(CLOUD_SHARE_NAME).resourcePath(CLOUD_FILE_DIR).buildDirectoryClient();
        return this.storageClient;
    }

    /**
     * Download the entire file blob from the cloud.
     *
     * @param fileName file to download.
     * @return
     * @throws IOException
     */
    @Override
    public OutputStream download(String fileName) throws IOException {
        ShareFileClient fileClient = this.initStorageClient().getFileClient(fileName);
        OutputStream out = new ByteArrayOutputStream();
        fileClient.download(out);
        return out;
    }

    /**
     * Download the file in chunks from the cloud.
     *
     * @param fileExtract FileExtract class, contains filename, etc
     * @throws IOException
     */
    @Override
    public void downloadToFile(FileExtract fileExtract) throws IOException {
        ShareFileClient fileClient = this.initStorageClient().getFileClient(fileExtract.getFileName());

        // chunk download
        int chunkSize = 1024*1024*100; // 100MB
        long totalFileSize = fileClient.getProperties().getContentLength();
        long remainingChunks = totalFileSize;
        long startPosition = 0;
        String localZip = fileExtract.getFilePath().replace(fileExtract.getFileExtension(), ".zip");
        new File(localZip).createNewFile();

        do {
            ByteArrayOutputStream bao = new ByteArrayOutputStream();
            fileClient.downloadWithResponse(bao, new ShareFileRange(startPosition, startPosition + chunkSize),
                    false, Duration.ofSeconds(60), Context.NONE);

            try (FileOutputStream out = new FileOutputStream(localZip, true)) {
                FileChannel ch = out.getChannel();
                ch.write(ByteBuffer.wrap(bao.toByteArray()));
            }
            bao.close();
            startPosition += chunkSize + 1;
            remainingChunks -= chunkSize;
            System.out.printf("Downloaded %s / %s total file size\n", totalFileSize - remainingChunks, totalFileSize);
        } while (remainingChunks > 0);

        this.extractFile(fileExtract.getFileDir(), fileExtract.getFileName());
    }

    private void extractZip(ZipFile zip, String localSaveDir) throws IOException {
        FileOutputStream out;
        byte[] buffer = new byte[1024];
        int read;
        ZipEntry entry;

        Enumeration<? extends ZipEntry> entries = zip.entries();

        while (entries.hasMoreElements()) {
            entry = entries.nextElement();
            String filePath = localSaveDir + "/" + entry.getName();
            out = new FileOutputStream(filePath);
            InputStream is = zip.getInputStream(entry);
            while ((read = is.read(buffer, 0, buffer.length)) != -1) {
                out.write(buffer, 0, read);
            }
            is.close();
            out.close();
        }
        zip.close();
    }

    /**
     * Extract a zip file.
     *
     * @param localSaveDir local directory containing zip file.
     * @param filename name of zip file.
     * @throws IOException
     */
    @Override
    public void extractFile(String localSaveDir, String filename) throws IOException {
        ZipFile zip = new ZipFile(localSaveDir + "/" + filename);
        this.extractZip(zip, localSaveDir);
    }

    /**
     * Save the byte stream to a file(s). This will effectively "unzip" and
     * save individual files.
     *
     * @param bao the zip file in bytes.
     * @param localSaveDir local directory to save file to.
     * @throws IOException
     */
    @Override
    public void writeToFile(ByteArrayOutputStream bao, String localSaveDir) throws IOException {
        ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bao.toByteArray()));

        FileOutputStream out;
        byte[] buffer = new byte[1024];
        int read;
        ZipEntry entry;

        while ((entry = zip.getNextEntry()) != null) {
            String filePath = localSaveDir + "/" + entry.getName();
            out = new FileOutputStream(filePath);
            while ((read = zip.read(buffer, 0, buffer.length)) != -1) {
                out.write(buffer, 0, read);
            }
            zip.closeEntry();
            out.close();
        }
        zip.close();
    }
}

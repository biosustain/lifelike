package edu.ucsd.sbrg.liquibase.storage;

import com.azure.storage.file.share.ShareDirectoryClient;
import com.azure.storage.file.share.ShareFileClient;
import com.azure.storage.file.share.ShareFileClientBuilder;

import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.zip.ZipEntry;
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

    @Override
    public OutputStream download(String fileName) throws IOException {
        ShareFileClient fileClient = this.initStorageClient().getFileClient(fileName);
        OutputStream out = new ByteArrayOutputStream();
        fileClient.download(out);
        return out;
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

package edu.ucsd.sbrg.liquibase.neo4j.cloudstorage;

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
    final String shareName = "knowledge-graph";
    final String fileDir = "migration";

    public AzureCloudStorage(String storageAccountName, String storageAccountKey, String saveDir) {
        this.connectionString = "DefaultEndpointsProtocol=https;" +
                "AccountName=" + storageAccountName + ";" +
                "AccountKey=" + storageAccountKey;
        this.localSaveDir = saveDir;
    }

    private ShareDirectoryClient getStorageClient(String shareName) {
        this.storageClient = new ShareFileClientBuilder().connectionString(this.connectionString)
                .shareName(shareName).resourcePath(this.fileDir).buildDirectoryClient();
        return this.storageClient;
    }

//    public void setShareName(String shareName) {
//        this.shareName = shareName;
//    }
//
    public String getShareName() {
        return this.shareName;
    }

    @Override
    public OutputStream download(String fileName) {
        ShareFileClient fileClient = this.getStorageClient(this.getShareName()).getFileClient(fileName);
        OutputStream out = new ByteArrayOutputStream();
        fileClient.download(out);
        return out;
    }

    /**
     * Save the byte stream to a file(s). This will effectively "unzip" and
     * save individual files.
     *
     * @param bao the zip file in bytes
     * @throws IOException
     */
    @Override
    public void writeToFile(ByteArrayOutputStream bao) throws IOException {
        ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bao.toByteArray()));

        FileOutputStream out;
        byte[] buffer = new byte[1024];
        int read;
        ZipEntry entry;

        while ((entry = zip.getNextEntry()) != null) {
            String filePath = this.localSaveDir + "/" + entry.getName();
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

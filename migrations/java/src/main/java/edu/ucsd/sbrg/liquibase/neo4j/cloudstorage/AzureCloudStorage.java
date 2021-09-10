package edu.ucsd.sbrg.liquibase.neo4j.cloudstorage;

import com.azure.storage.file.share.ShareDirectoryClient;
import com.azure.storage.file.share.ShareFileClient;
import com.azure.storage.file.share.ShareFileClientBuilder;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;

public class AzureCloudStorage extends CloudStorage {
    ShareDirectoryClient storageClient;
    String shareName;
    final String fileDir = "migration";

    public AzureCloudStorage(String storageAccountName, String storageAccountKey) {
        this.connectionString = "DefaultEndpointsProtocol=https;" +
                "AccountName=" + storageAccountName + ";" +
                "AccountKey=" + storageAccountKey;
    }

    private ShareDirectoryClient getStorageClient(String shareName) {
        this.storageClient = new ShareFileClientBuilder().connectionString(this.connectionString)
                .shareName(shareName).resourcePath(this.fileDir).buildDirectoryClient();
        return this.storageClient;
    }

    public void setShareName(String shareName) {
        this.shareName = shareName;
    }

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
}

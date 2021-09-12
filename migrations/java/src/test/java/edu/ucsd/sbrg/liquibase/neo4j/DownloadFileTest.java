package edu.ucsd.sbrg.liquibase.neo4j;

import edu.ucsd.sbrg.liquibase.neo4j.cloudstorage.AzureCloudStorage;
import static org.junit.Assert.assertNotEquals;
import org.junit.Before;
import org.junit.Ignore;
import org.junit.Test;

import java.io.IOException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class DownloadFileTest {
    final String fileName = "";
    private AzureCloudStorage cloudStorage;
    final String storageName = "";
    final String storageKey = "";
    final String saveDir = "";

    @Before
    public void setUp() {
        cloudStorage = new AzureCloudStorage(this.storageName, this.storageKey, this.saveDir);
    }

    @Ignore // ignore and run manually, cause need storage keys etc
    @Test
    public void testDownloadToFile() throws IOException {
        ByteArrayOutputStream bao = (ByteArrayOutputStream) cloudStorage.download(this.fileName);
        ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bao.toByteArray()));

        FileOutputStream out;
        byte[] buffer = new byte[1024];
        int read;
        ZipEntry entry;
        List<String> files = new ArrayList<>();
        String filePath = "";

        while ((entry = zip.getNextEntry()) != null) {
            filePath = this.saveDir + "/" + entry.getName();
            files.add(filePath);
            out = new FileOutputStream(filePath);
            while ((read = zip.read(buffer, 0, buffer.length)) != -1) {
                out.write(buffer, 0, read);
            }
            zip.closeEntry();
            out.close();
        }
        zip.close();

        files.forEach(f -> {
            File downloaded = new File(f);
            assertNotEquals(0, downloaded.length());
            downloaded.delete();
        });
    }
}

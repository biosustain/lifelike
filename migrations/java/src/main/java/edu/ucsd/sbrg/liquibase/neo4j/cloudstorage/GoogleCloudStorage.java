package edu.ucsd.sbrg.liquibase.neo4j.cloudstorage;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;

public class GoogleCloudStorage extends CloudStorage {
    @Override
    public OutputStream download(String fileName) {
        return null;
    }

    @Override
    public void writeToFile(ByteArrayOutputStream bao) throws IOException {
        //
    }
}

package edu.ucsd.sbrg.liquibase.neo4j.cloudstorage;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

public abstract class CloudStorage implements StorageInterface {
    String connectionString;
    String localSaveDir;

    public String getLocalSaveDir() {
        return this.localSaveDir;
    }

    public abstract void writeToFile(ByteArrayOutputStream bao) throws IOException;
}

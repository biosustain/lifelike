package edu.ucsd.sbrg.liquibase.neo4j.cloudstorage;

import java.io.OutputStream;

public interface StorageInterface {
    public OutputStream download(String fileName);
}

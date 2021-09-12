package edu.ucsd.sbrg.liquibase.storage;

import java.io.IOException;
import java.io.OutputStream;

public interface Storage {
    public OutputStream download(String fileName) throws IOException;
}

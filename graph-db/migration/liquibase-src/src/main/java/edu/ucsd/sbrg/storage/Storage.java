package edu.ucsd.sbrg.storage;

import edu.ucsd.sbrg.extract.FileExtract;

import java.io.IOException;
import java.io.OutputStream;

public interface Storage {
    public OutputStream download(String fileName) throws IOException;

    public void downloadToFile(FileExtract fileExtract) throws IOException;
}

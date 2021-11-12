package edu.ucsd.sbrg.storage;

import edu.ucsd.sbrg.extract.FileExtract;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;

public class GoogleCloudStorage extends CloudStorage {
    @Override
    public OutputStream download(String fileName) {
        return null;
    }

    @Override
    public void downloadToFile(FileExtract fileExtract) throws IOException {
        //
    }

    @Override
    public void writeToFile(ByteArrayOutputStream bao, String localSaveDir) throws IOException {
        //
    }

    @Override
    public void extractFile(String localSaveDir, String filename) throws IOException {
        //
    }
}

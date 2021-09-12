package edu.ucsd.sbrg.liquibase.extract;

public abstract class FileExtract implements Extract {
    String fileDir;
    String fileExtension;
    String fileName;
    String filePath;

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFileName() {
        return this.fileName;
    }

    public void setFileExtension(String fileExtension) {
        this.fileExtension = fileExtension;
    }

    public String getFileExtension() { return this.fileExtension; }

    public void setFileDir(String fileDir) {
        this.fileDir = fileDir;
    }

    public String getFileDir() {
        return this.fileDir;
    }

    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getFilePath() {
        return this.filePath;
    }
}

package edu.ucsd.sbrg.liquibase.extract;

import java.io.IOException;
import java.util.List;

public interface Extract {
    public List<String[]> getFileContent() throws IOException;
}

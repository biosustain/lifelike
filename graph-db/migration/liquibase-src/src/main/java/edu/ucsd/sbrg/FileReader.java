package edu.ucsd.sbrg;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.*;

public class FileReader {
    static final Logger logger = LogManager.getLogger(FileReader.class);

    FileReader() {}

    public FileContent readFile(String filepath, String delimiter, int startAt) throws IOException {
        final int chunkSize = 5000;
        int skipCount = 0;
        String[] header = null;

        FileInputStream input = new FileInputStream(filepath);
        Scanner sc = new Scanner(input);
        sc.useDelimiter(delimiter);

        Queue<List<String[]>> results = new LinkedList<>();
        List<String[]> subList = new ArrayList<>();

        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            logger.debug("Read line '" + currentLine + "' from file.");
            if (header == null) {
                header = currentLine.split(delimiter, -1);
                skipCount++;
            } else {
                if (skipCount != startAt) {
                    skipCount++;
                } else {
                    if ((subList.size() > 0 && (subList.size() % (chunkSize * 4) == 0))) {
                        results.add(subList);
                        subList = new ArrayList<>();
                    }
                    subList.add(currentLine.split(delimiter, -1));
                }
            }
        }

        // wrap up any leftovers in content
        // since file could be smaller than chunkSize * 4
        if (subList.size() > 0) {
            results.add(subList);
        }

        sc.close();
        input.close();
        return new FileContent(header, results);
    }
}

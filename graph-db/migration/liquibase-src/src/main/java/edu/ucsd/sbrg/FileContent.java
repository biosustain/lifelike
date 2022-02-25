package edu.ucsd.sbrg;

import java.util.List;
import java.util.Queue;

public class FileContent {
    String[] header;
    Queue<List<String[]>> content;

    FileContent(String[] header, Queue<List<String[]>> content) {
        this.header = header;
        this.content = content;
    }

    public String[] getHeader() {
        return header;
    }

    public Queue<List<String[]>> getContent() {
        return content;
    }
}

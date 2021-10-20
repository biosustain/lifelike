package edu.ucsd.sbrg.neo4j;

import liquibase.exception.CustomChangeException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.neo4j.driver.*;

import java.util.Arrays;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import static org.neo4j.driver.Values.parameters;

public class Neo4jGraph {
    String neo4jHost;
    String neo4jUsername;
    String neo4jPassword;
    String databaseName;
    Driver driver;

    static final Logger logger = LogManager.getLogger(Neo4jGraph.class);

    public Neo4jGraph(String neo4jHost, String neo4jCredentials) {
        this(neo4jHost, neo4jCredentials, "neo4j");
    }

    public Neo4jGraph(String neo4jHost, String neo4jCredentials, String databaseName) {
        String[] creds = neo4jCredentials.split(",");
        this.neo4jHost = neo4jHost;
        this.neo4jUsername = creds[0];
        this.neo4jPassword = creds[1];
        this.databaseName = databaseName;
        if (databaseName == null) {
            this.databaseName = "neo4j";
        }
        this.driver = GraphDatabase.driver(neo4jHost, AuthTokens.basic(neo4jUsername, neo4jPassword));
    }

    public String getNeo4jHost() {
        return this.neo4jPassword;
    }

    public String getNeo4jUsername() {
        return this.neo4jUsername;
    }

    public String getNeo4jPassword() {
        return this.neo4jPassword;
    }

    public Driver getDriver() { return this.driver; }

    public Session getSession() {
        return this.driver.session(SessionConfig.forDatabase(databaseName));
    }

    private Collection<List<String[]>> partitionData(List<String[]> data, int chunkSize) {
        logger.info("Partitioning data into " + chunkSize + " chunk size.");
        AtomicInteger counter = new AtomicInteger();
        return data.stream()
                .collect(Collectors.groupingBy(i -> counter.getAndIncrement() / chunkSize)).values();
    }

    public void execute(String query, List<String[]> data, String[] keys, int chunkSize) throws CustomChangeException {
        if (keys.length != data.get(0).length) {
            logger.debug("Invalid length not equal; keys.length = " + keys.length + " and data.get(0).length = " + data.get(0).length + ".");
            throw new IllegalArgumentException("The number of keys do not match number of data entries!");
        }

        Collection<List<String[]>> chunkedData = this.partitionData(data, chunkSize);
        List<List<Map<String, String>>> chunkedCypherParams = new ArrayList<>();

        logger.info("Creating chunks of cypher parameters.");
        chunkedData.forEach(contentChunk -> {
            logger.info("New cypher parameters chunk");
            List<Map<String, String>> cypherParamsChunk = new ArrayList<>();
            contentChunk.forEach(row -> {
                Map<String, String> param = new HashMap<>();
                try {
                    StringBuilder sb = new StringBuilder();
                    sb.append("Added to param chunk: {");
                    for (int i = 0; i < keys.length; i++) {
                        param.put(keys[i], row[i]);
                        sb.append(keys[i] + ": " + row[i]);
                        sb.append(",");
                    }
                    // delete the last comma
                    sb.deleteCharAt(sb.length() - 1);
                    sb.append("}");
                    logger.info(sb.toString());
                } catch (IndexOutOfBoundsException e) {
                    throw new IndexOutOfBoundsException();
                }
                cypherParamsChunk.add(param);
            });
            chunkedCypherParams.add(cypherParamsChunk);
        });

        Session session = this.driver.session(SessionConfig.forDatabase(databaseName));
        logger.info("Executing cypher query: " + query);
        chunkedCypherParams.forEach(paramChunk -> {
            session.writeTransaction(tx -> tx.run(query, parameters("rows", paramChunk)));
        });
        session.close();
    }
}

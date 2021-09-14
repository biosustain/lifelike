package edu.ucsd.sbrg.liquibase.neo4j;

import liquibase.exception.CustomChangeException;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.neo4j.driver.Session;

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
    Driver driver;

    public Neo4jGraph(String neo4jHost, String neo4jUsername, String neo4jPassword) {
        this.neo4jHost = neo4jHost;
        this.neo4jUsername = neo4jUsername;
        this.neo4jPassword = neo4jPassword;
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

    private Collection<List<String[]>> partitionData(List<String[]> data, int chunkSize) {
        AtomicInteger counter = new AtomicInteger();
        return data.stream()
                .collect(Collectors.groupingBy(i -> counter.getAndIncrement() / chunkSize)).values();
    }

    public void execute(String query, List<String[]> data, String[] keys, int chunkSize) throws CustomChangeException {
        if (keys.length != data.get(0).length) {
            throw new IllegalArgumentException("The number of keys do not match number of data entries!");
        }

        Collection<List<String[]>> chunkedData = this.partitionData(data, chunkSize);
        List<List<Map<String, String[]>>> chunkedCypherParams = new ArrayList<>();

        chunkedData.forEach(contentChunk -> {
            List<Map<String, String[]>> cypherParamsChunk = new ArrayList<>();
            contentChunk.forEach(row -> {
                Map<String, String[]> param = new HashMap<>();
                try {
                    for (int i = 0; i < keys.length; i++) {
                        param.put(keys[i], row[i].split(","));
                    }
                } catch (IndexOutOfBoundsException e) {
                    throw new IndexOutOfBoundsException();
                }
                cypherParamsChunk.add(param);
            });
            chunkedCypherParams.add(cypherParamsChunk);
        });

        Session session = this.driver.session();
        chunkedCypherParams.forEach(paramChunk -> {
            session.writeTransaction(tx -> tx.run(query, parameters("rows", paramChunk)));
        });
        session.close();
    }
}

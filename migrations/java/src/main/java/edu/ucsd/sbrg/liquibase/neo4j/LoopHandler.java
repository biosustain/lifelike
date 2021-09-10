package edu.ucsd.sbrg.liquibase.neo4j;

import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Helper class for queries that need to loop.
 */
public class LoopHandler implements CustomTaskChange {
    private Driver driver;
    private String query;
    private ResourceAccessor resourceAccessor;

    public LoopHandler() { }

    public String getQuery() {
        return this.query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public void setDatabaseDriver(String uri, String user, String password) {
        this.driver = GraphDatabase.driver(uri, AuthTokens.basic(user, password));
    }

    @Override
    public void execute(Database database) throws CustomChangeException {
        // TODO: temp way to get database credentials
        // need to figure out how to get credentials from liquibase
        final String host = System.getenv("NEO4J_INSTANCE_URI");
        final String username = System.getenv("NEO4J_USERNAME");
        final String password = System.getenv("NEO4J_PWD");

        System.out.println("Executing query: " + this.getQuery());

        this.setDatabaseDriver(host, username, password);

        try (Session session = driver.session()) {
            int totalProcessed = 0;

            while (true) {
                final int processed = this.executeCypherStatement(session, this.getQuery());
                totalProcessed += processed;
                System.out.format("Processed %d nodes...%n", totalProcessed);
                if (processed == 0) {
                    break;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            throw new CustomChangeException();
        }
    }

    public Integer executeCypherStatement(Session session, String cypher) {
        return session.writeTransaction(tx -> {
            Result results = tx.run(cypher);
            return results.single().get(0).asInt();
        });
    }

    /**
     * Executes the query that acts as the loop condition.
     * @param session
     * @param cypher
     * @return          list of node ids (something is wrong if return list of nodes),
     *                  not sure what (get EncodeException), can't find enough documentation in Neo4j website
     *                  so workaround is to return the ids, and query them in the
     *                  query passed to @executeCypherStatement()
     */
    public List<List<String>> getNodesToUpdate(Session session, String cypher) {
        return session.readTransaction(tx -> {
            List<List<String>> results = tx.run(cypher).list().stream().map(
                    recordList -> recordList.get("nodes").asList(Values.ofString())
            ).collect(Collectors.toList());
            return results;
        });
    }

    @Override
    public String getConfirmationMessage() {
        return "Working";
    }

    @Override
    public void setUp() throws SetupException { }

    @Override
    public void setFileOpener(ResourceAccessor resourceAccessor) {
        this.resourceAccessor = resourceAccessor;
    }

    @Override
    public ValidationErrors validate(Database database) {
        return new ValidationErrors();
    }
}

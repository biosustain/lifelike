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
import org.neo4j.driver.Record;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;

import static org.neo4j.driver.Values.parameters;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Helper class for queries that need to depend on another query.
 *
 * E.g
 *      while (query1.size > 0)
 *      do
 *          query2
 */
public class LoopHandler implements CustomTaskChange {
    private Driver driver;
    private String execQuery;
    private String loopQuery;
    private ResourceAccessor resourceAccessor;

    public LoopHandler() { }

    public String getExecQuery() { return this.execQuery; }

    public void setExecQuery(String execQuery) {
        this.execQuery = execQuery;
    }

    public String getLoopQuery() { return this.loopQuery; }

    public void setLoopQuery(String loopQuery) {
        this.loopQuery = loopQuery;
    }

    public void setDatabaseDriver(String uri, String user, String password) {
        this.driver = GraphDatabase.driver(uri, AuthTokens.basic(user, password));
    }

    @Override
    public void execute(Database database) throws CustomChangeException {
        // TODO: temp way to get database credentials
        // need to figure out how to get credentials from liquibase
        final String host = System.getenv("SBRG_NEO4J_URL");
        final String username = System.getenv("SBRG_NEO4J_USERNAME");
        final String password = System.getenv("SBRG_NEO4J_PASSWORD");

        System.out.println("Loop query: " + this.getLoopQuery());
        System.out.println("Exec query: " + this.getExecQuery());

        this.setDatabaseDriver(host, username, password);

        try (Session session = driver.session()) {
            List<List<String>> nodes = this.getNodesToUpdate(session, this.getLoopQuery());

            int totalProcessed = 0;

            while (nodes.size() > 0) {
                totalProcessed += this.executeCypherStatement(session, this.getExecQuery(), nodes);
                System.out.format("Processed %d nodes...%n", totalProcessed);
                System.out.println("Getting next batch of nodes...");
                nodes = this.getNodesToUpdate(session, this.getLoopQuery());
            }
        } catch (Exception e) {
            e.printStackTrace();
            throw new CustomChangeException();
        }
    }

    public Integer executeCypherStatement(Session session, String cypher, List<List<String>> params) {
        return session.writeTransaction(tx -> {
            List<Record> results = tx.run(cypher, parameters("nodes", params)).list();
            return results.size();
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

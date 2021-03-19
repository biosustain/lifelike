## Cypher Query Performance Tips

This document contains a collection of tips/tricks related to Cypher query performance. As a starting point, it is highly recommended to at least skim the following articles:

- [Neo4j Docs on Tuning](https://neo4j.com/docs/cypher-manual/current/query-tuning/)
- [Neo4j Query Tuning Blog](https://neo4j.com/docs/cypher-manual/current/query-tuning/)
- [Another Query Tuning Article](https://neo4j.com/blog/cypher-write-fast-furious/)

### General Tips
- You can use the `PROFILE` keyword to inspect the performance of any query. In the Neo4j browser, what you'll mostly be concerned with is the number of [db hits](https://neo4j.com/docs/cypher-manual/current/execution-plans/#execution-plans-dbhits):
<img width="1034" alt="Screen Shot 2020-04-02 at 3 19 25 PM" src="https://user-images.githubusercontent.com/12260867/78305337-7fe8e380-74f5-11ea-830f-ef83d5e87b4b.png">

- Use node labels whenever possible
    - If a query is slow, check if you are using labels (e.g. `(n:Chemical)`), and check the performance of the query after adding them.

- Always use a params object to inject values into a query
    - This is opposed to using python string formatting to insert values into a query. The way Neo4j generates query plans, especially for `UNWIND` statements, it is much better to use the built in parameter syntax for Cypher. For example, changing 
        ```python
        query = f"MATCH (n:Chemical) WHERE ID(n)={my_id} RETURN n"
        graph.run(query)
        ```
    
        to something like

        ```python
        query = "MATCH (n:Chemical) WHERE ID(n)=$my_id RETURN n"
        graph.run(query, {'my_id': my_id})
        ```
     
- Try not to use node objects as the basis for a search
    - For example, it is better to change 
       ```cypher
       MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
       WHERE ID(f)={} AND ID(t)={} AND a.description='{}'
       WITH a AS association
       MATCH (association)-[:HAS_REF]-(r:Reference)-[:HAS_PUBLICATION]-(p:Publication)
       RETURN r AS reference, p AS publication
       ```
       
       into something like
       
       ```cypher
       MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
       WHERE ID(f)={} AND ID(t)={} AND a.description='{}'
       WITH ID(a) AS association_id
       MATCH (a:Association)-[:HAS_REF]-(r:Reference)-[:HAS_PUBLICATION]-(p:Publication)
       WHERE ID(a)=association_id
       RETURN r AS reference, p AS publication
       ```

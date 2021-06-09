# Create HumanCyc graphdb for GDS (LL-3084)
#### 1. Create database humancyc, then load data using the following code

Code to load data (project Lifelike-graphdb)
```
parser = BiocycParser()
database = get_database(Neo4jInstance.LOCAL, 'humancyc')
parser.load_data_into_neo4j(database, ENTITIES, {DB_HUMANCYC: 'humancyc.tar.gz'}, True)
database.close()
```

#### 2. Remove synonyms

```
match(n:Synonym) detach delete n;

```
#### 3. Set entity descriptions

    ```
    match(n:Gene)-[:ENCODES]-(x) set n.description = x.name;
    
    match (p)-[:COMPONENT_OF]->(n:Protein) where not exists(n.name)
    with n, collect(p.name) as comps set n.name = 'complex of ' + apoc.text.join(comps, ', ');

    match (n:Reaction:db_EcoCyc) with n match (x)-[:CONSUMED_BY]-(n)-[:PRODUCES]-(y) 
    with n, collect(distinct x.displayName) as c1, collect(distinct y.displayName) as c2,
    case when n.direction = 'REVERSIBLE' then ' <==> '
    when n.direction contains 'RIGHT-TO-LEFT' then ' <== '
    else ' ==> ' end as symbol 
    set n.description = apoc.text.join(c1, ' + ') + symbol + apoc.text.join(c2, ' + ');
    ```
#### 4. Set correction reaction directions
```
drop constraint constraint_biocyc_biocycId;

match (n:Reaction) where n.direction ends with 'RIGHT-TO-LEFT' match (n)-[r1:CONSUMED_BY]-(c1), (n)-[r2:PRODUCES]-(c2) merge (n)-[:PRODUCES]->(c1) merge (c2)-[:CONSUMED_BY]->(n) delete r1 delete r2;

match(n:Reaction) where n.direction = 'REVERSIBLE' with n 
match (n)-[:PRODUCES]-(p), (n)-[:CONSUMED_BY]-(c) where id(p) = id(c) 
with collect(distinct n) as undirectReactions 
match(n:Reaction) where n.direction = 'REVERSIBLE' and not n in undirectReactions 
with collect(n) as inputNodes 
call apoc.refactor.cloneNodesWithRelationships(inputNodes) yield input, output 
return count(*);

match(n:Reaction) with n.id as id, collect(n) as nodes where size(nodes) > 1 with nodes[0] as n 
set n.id = n.biocyc_id + '_r';

match(n:Reaction) where n.id ends with '_r' with n 
match (n)-[r1:CONSUMED_BY]-(c1), (n)-[r2:PRODUCES]-(c2) merge (n)-[:PRODUCES]->(c1) merge (c2)-[:CONSUMED_BY]->(n) delete r1 delete r2;
```

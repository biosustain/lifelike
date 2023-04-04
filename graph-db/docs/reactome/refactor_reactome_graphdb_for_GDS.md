// Modify Reactome database for GDS (LL-3119)

////// 0. Reverse inputs
Somewhere between version 75 and 84 reactome reversed these relations so we reverse them for cosistency with old code
```cypher
MATCH ()-[r:input]->() call apoc.refactor.invert(r) yield input, output return count(*)
```

////// 1. Remove "un-needed" nodes and labels
- Remove label: DatabaseObject (removed label for 2442414 nodes)
    ```
    call apoc.periodic.iterate(
    "match(n:DatabaseObject) return n", 
    'remove n:DatabaseObject', 
    {batchSize: 5000, parallel:True}
    )
    ```
- Remove nodes: InstanceEdit (parallel failed) (deleted 117465 nodes)
    ```
    call apoc.periodic.iterate(
    "match(n:InstanceEdit) return n", 
    'detach delete n', 
    {batchSize: 5000}
    )
    ```
- Remove person, publication etc.
    ```
    match(n:Affiliation) detach delete n; // Deleted 327 nodes, deleted 556 relationships
    match(n:Person) detach delete n; // Deleted 145880 nodes, deleted 222947 relationships
    match(n:Publication) detach delete n; // Deleted 36438 nodes, deleted 89396 relationships
    ```
    
- Remove all Tax 
    ```
    match(n:Taxon) detach delete n // Deleted 390 nodes, deleted 1249099 relationships
    ```
    
- Remove all non-human events 
All events have property 'speciesName'.  
```
match(n:Event) where n.speciesName <> 'Homo sapiens' detach delete n // Deleted 95291 nodes, deleted 904579 relationships
```
    
- Remove non-human PhysicalEntity
4783 physical entities did not have speciesName, including SimpleEntity and others. Keep them. 
```
match(n:PhysicalEntity) where  exists (n.speciesName) and n.speciesName <> 'Homo sapiens' detach delete n // Deleted 349063 nodes, deleted 1575214 relationships
```

////// 2. Set commonName and compartment properties
- Set PhysicalEntity common name, and create index
```
match(n:PhysicalEntity) set n.commonName = n.name[0] // Set 56086 properties
```

- Set compartment property
    ```
    match(n:PhysicalEntity)-[r:compartment]-(x)
    with n, collect(x.name) as gos set n.compartment = gos; // Set 56086 properties
    match(n:PhysicalEntity)-[r:compartment]-(x) delete r; // Deleted 56171 relationships
    
    match(n:Event)-[r:compartment]-(x)  
    with n, collect(x.name) as gos set n.compartment = gos; // Set 15264 properties
    match(n:Event)-[r:compartment]-(:GO_Term) delete r // Deleted 22531 relationships
    ```
  
////// 3. Set GNE, RNA, Protein and Chemical labels
```
match(n:EntityWithAccessionedSequence) where (n)-[:referenceEntity]-(:ReferenceDNASequence) set n:Gene; // Added 1336 labels
match(n:EntityWithAccessionedSequence) where (n)-[:referenceEntity]-(:ReferenceRNASequence) set n:RNA; // Added 309 labels
match(n:EntityWithAccessionedSequence) where (n)-[:referenceEntity]-(:ReferenceGeneProduct) set n:Protein; // Added 29011 labels

match(n:SimpleEntity) set n:Chemical; // Added 3648 labels
```

////// 4. Reverse a few relationshps for better traversal
```
match(n:Complex)-[r:hasComponent]->(x) merge (x)-[:componentOf]->(n) delete r; // Deleted 32536 relationships, created 32536 relationships
match(n:EntitySet)-[r:hasMember]->(x) merge (x)-[:memberOf]->(n) delete r; // Deleted 25906 relationships, created 25906 relationships
match(n:ReactionLikeEvent)-[r:catalystActivity]->(x) merge (x)-[:catalyzes]->(n) delete r; // Deleted 6158 relationships, created 6158 relationships
match (n:CatalystActivity)-[r:physicalEntity]->(x) merge (x)-[:catalystOf]->(n) delete r; // Deleted 4724 relationships, created 4724 relationships
match (n:CatalystActivity)-[r:activeUnit]->(x) merge (x)-[:activeUnitOf]->(n) delete r; // Deleted 1156 relationships, created 1156 relationships
match (n)-[r:regulatedBy]->(x:Regulation) merge (x)-[:regulates]->(n) delete r; // Deleted 2381 relationships, created 2381 relationships
match(n:Regulation)-[r:regulator]->(x) merge (x)-[:regulatorOf]->(n) delete r; // Deleted 2284 relationships, created 2284 relationships
match(n:Regulation)-[r:activeUnit]->(x) merge (x)-[:activeUnitOf]->(n) delete r; // Deleted 834 relationships, created 834 relationships
```

////// 5. Removed referredTo relationships:
```
match (n)-[r:inferredTo]->(m) delete r // Deleted 455 relationships
```

////// 6. Refactor 'translocate' and 'transport' reactions with EntitySet in both input and output
- Mark reaction nodes to refactor
```
match(n:ReactionLikeEvent {category: 'transition'})
 where (n.displayName contains 'transport') or (n.displayName contains 'translocate') 
with n match (s1:EntitySet)-[:input]-(n)-[:output]-(s2:EntitySet) 
set n.refactorStatus = 'refactored' // Set 88 properties
```
67 nodes were marked with property refactorStatus = 'refactored'

-- Drop constraints and create indexes instead
With unique constraints for dbId and stId, cloning nodes would fail.
```
drop constraint on (n:Event) assert n.dbId is unique; // Removed 1 constraint
drop constraint on (n:Event) assert n.stId is unique; // Removed 1 constraint
drop constraint on (n:ReactionLikeEvent) assert n.dbId is unique; // Removed 1 constraint
drop constraint on (n:ReactionLikeEvent) assert n.stId is unique; // Removed 1 constraint
drop constraint on (n:Reaction) assert n.dbId is unique; // Removed 1 constraint
drop constraint on (n:Reaction) assert n.stId is unique; // Removed 1 constraint

create index for (n:ReactionLikeEvent) on (n.dbId); // Added 1 index
create index for (n:ReactionLikeEvent) on (n.stId); // Added 1 index
````

-- Clone reactions and add input-output relationships
```
match(n:ReactionLikeEvent {refactorStatus: 'refactored'}) 
with n match (s1:EntitySet)-[:input]-(n)-[:output]-(s2:EntitySet) 
with n, s1, s2 match (s1)<-[:memberOf]-(m1), (s2)<-[:memberOf]-(m2) 
where (m1)-[:referenceEntity]-()-[:referenceEntity]-(m2)
with n, m1, m2 call apoc.refactor.cloneNodes([n]) yield input, output as n2
set n2.refactorStatus = 'added'
merge (m1)-[:input]->(n2)-[:output]->(m2)
return count(*) // count 373
```
276 nodes added

-- add regulates relationships to newly created nodes
```
match(n:ReactionLikeEvent {refactorStatus: 'refactored'})-[:regulates]-(r) 
with n, r match (n2:ReactionLikeEvent) where n2.dbId = n.dbId and n2.refactorStatus = 'added'
merge (r)-[:regulates]->(n2) // Created 30 relationships
```
2 relationships added

-- add catalyzes relationships to newly created nodes
```
match(n:ReactionLikeEvent {refactorStatus: 'refactored'})-[:catalyzes]-(c) 
with n, c match (n2:ReactionLikeEvent) where n2.dbId = n.dbId and n2.refactorStatus = 'added'
merge (c)-[:catalyzes]->(n2) // Created 331 relationships
```
236 relationships created

-- dominiks reflactions on newer reactome version
```cypher
match (n:NegativePrecedingEvent) detach delete n; // safe to delete nodes (does not share nodes with robin db)
match (n:NegativePrecedingEventReason) detach delete n; // safe to delete nodes (does not share nodes with robin db)
match (n:DrugActionType) detach delete n; // safe to delete nodes (does not share nodes with robin db)
match ()-[r:cellType]->() delete r; // safe to delete relations?

match (n:CellType) remove n:CellType;
match (n:ControlledVocabulary) remove n:ControlledVocabulary;
match (n:ReactionType) remove n:ReactionType;
```

// additinal changes (local lifelike-stg instance reactome-human) 
```
create constraint constraint_synonym_name on (n:Synonym) assert (n.name) is Unique; // Added 1 constraint
match(n:ReferenceGeneProduct) with n unwind n.geneName as synonym 
merge (s:Synonym {name:synonym}) merge (n)-[:HAS_SYNONYM]->(s); // Added 60893 labels, created 60893 nodes, set 60893 properties, created 94021 relationships

call apoc.periodic.iterate(
    "match(n:PhysicalEntity) unwind n.name as syn return n, syn",
    "merge(s:Synonym {name:syn}) merge (n)-[:HAS_SYNONYM]->(s)",
    {batchSize: 5000} // ??
)
```


////// Based on Christian's code, the following changes made
8/24/2021
- Change hasCandidate to candidateOf, reverse
- Change requiredInputComponent to requiredInput, reverse
- Change repeatedUnit to repeatedUnitOf, reverse
``` 
match(n)-[r:hasCandidate]->(x) merge (x)-[:candidateOf]->(n) delete r; // Deleted 8653 relationships, created 8653 relationships
match(n)-[r:requiredInputComponent]->(x) merge (x)-[:requiredInput]->(n) delete r; // Deleted 62 relationships, created 62 relationships
match(n)-[r:repeatedUnit]->(x) merge (x)-[:repeatedUnitOf]->(n) delete r // Deleted 240 relationships, created 240 relationships
```

9/15/2021
set nodeLabel for display 
``` 
match(n:Protein) set n.nodeLabel ='Protein'; // Set 29011 properties
match(n:Gene) set n.nodeLabel='Gene'; // Set 1336 properties
match(n:ReferenceGeneProduct) set n.nodeLabel = 'Gene'; // Set 104293 properties
match(n:Chemical) set n.nodeLabel = 'Chemical'; // Set 3648 properties
match(n:Complex) set n.nodeLabel = 'Complex'; // Set 14133 properties
match(n:EntitySet) set n.nodeLabel = 'EntitySet'; // Set 5512 properties
match(n:Polymer) set n.nodeLabel = 'Polymer'; // Set 234 properties
match(n:ProteinDrug) set n.nodeLabel = 'Protein'; // Set 86 properties
match(n:ChemicalDrug) set n.nodeLabel = 'Chemical'; // Set 1027 properties
match(n:RNA) set n.nodeLabel = 'RNA'; // Set 309 properties
match(n:PhysicalEntity) where not exists (n.nodeLabel) set n.nodeLabel = 'Entity'; // Set 790 properties

match(n:ReactionLikeEvent) set n.nodeLabel = 'Reaction'; // Set 14770 properties
match(n:CatalystActivity) set n.nodeLabel = 'CatalystActivity'; // Set 37914 properties
match(n:Regulation) set n.nodeLabel = 'Regulation'; // Set 6503 properties
match(n:Pathway) set n.nodeLabel = 'Pathway'; // Set 2610 properties
```

The SQLAlchemy bulk functions `bulk_insert_mappings`, `bulk_update_mappings`, etc all use the PostgreSQL `executemany()` function.
- https://docs.sqlalchemy.org/en/13/orm/persistence_techniques.html#bulk-operations
- https://docs.sqlalchemy.org/en/13/core/tutorial.html#executing-multiple-statements
- https://docs.sqlalchemy.org/en/13/orm/session_api.html#sqlalchemy.orm.session.Session.bulk_insert_mappings

But by default, the `executemany()` is not a performant function, as even though it is "bulk", the function still executes an operation for every parameter in the sequence. (https://www.psycopg.org/docs/cursor.html#cursor.executemany)

So, for these lines of code
```python
session.bulk_save_objects([...])
# or
session.execute(AnnotationStopWords.__table__.insert(), [{'word': 'test'}, {'word': 'food'}]) 
# or
session.bulk_insert_mappings(OrganismGeneMatch, [...])
```

We get the following logs:

```
... statement: INSERT INTO organism_gene_match (...) VALUES ('44157038', 'CD630_RS19880', 'CD630_RS19880', '272563', 'Clostridioides difficile 630')
... statement: INSERT INTO organism_gene_match (...) VALUES ('44157038', 'CD630_RS19880', 'CD630_35701', '272563', 'Clostridioides difficile 630')
... statement: INSERT INTO organism_gene_match (...) VALUES ('44157037', 'CD630_RS19875', 'CD630_33682', '272563', 'Clostridioides difficile 630')
... ...
```

## The Correct Logs
The difference here is there is only one query, and the values are separated by commas (as noted in the documentation).
```
... statement: INSERT INTO organism_gene_match (...) VALUES
        ('44157038', 'CD630_RS19880', 'CD630_RS19880', '272563', 'Clostridioides difficile 630'),
        ('44157038', 'CD630_RS19880', 'CD630_35701', '272563', 'Clostridioides difficile 630'),
        ...
```
## The Fix
SQLAlchemy 1.3 requires manual configuration to use the helper functions (mentioned above). To do this, we enable the `executemany_mode` (https://docs.sqlalchemy.org/en/13/dialects/postgresql.html#psycopg2-fast-execution-helpers).

Once this is set, we can see the logs output the correct query.

See Pull Request for implementation: https://github.com/SBRG/kg-prototypes/pull/717
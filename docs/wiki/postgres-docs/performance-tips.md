# General PGDB Performance Tips

## Indexes

See [this](https://stackoverflow.com/a/1130) SO post for an excellent synopsis of why we use database indexes and how they work. In general, we want to add indexes on columns we know will have a very high volume of unique values, and that will be searched often. Indexes are not very useful on columns that have few unique values. 

#### Pros
* Can drastically speed up database searches when filtering on the indexed column.

#### Cons
* Can slow down inserts, deletions, and updates because indexes also need to be updated.
* Requires more memory on disk.

### Indexes on Primary Keys
* Postgres automatically creates indexes on primary keys when they are created.

### Indexes on Foreign Keys
* Postgres _does not_ create indexes on foreign keys when they are created.
* It is recommended to create indexes on foreign keys, for a number of reasons:
    * They are likely to be used in `SELECT` statements and joins quite often.
    * They can actually speed up deletes on the parent table (the table the foreign key originates from). When a parent table row is deleted, every table containing a foreign key to that table needs to be scanned for the deleted key so rows containing that key can also be deleted. Without an index, this results in a full table scan.
* See [this](https://sqlperformance.com/2012/11/t-sql-queries/benefits-indexing-foreign-keys) blog post for a great example of why indexes on foreign keys can be useful.
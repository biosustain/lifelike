## All PDF Annotations in a Folder/File

* Includes all subfolders all the way down
* Enrichment table annotations are stored slightly differently and are not included in this query
* If you have circular folder parents (which isn't allowed but can occur due to a bug or manual database editing), this query will throw an infinite stack error (probably)

```sql
WITH RECURSIVE _parents AS (
    SELECT
        id
        , parent_id
    FROM files
    WHERE id = 1 /* CHANGE ME: set to a folder (includes all subfolders too) or a file */
    UNION ALL
    SELECT
        c.id
        , c.parent_id
    FROM files c
    INNER JOIN _parents parent ON parent.id = c.parent_id
)
SELECT
    pdf_annotations.*
FROM _parents file_ids
INNER JOIN (
    SELECT
        file.id AS file_id
        , file.hash_id
        , file.filename
        , annotation.uuid
        , annotation.keyword
        , meta->>'id' AS id
        , meta->>'type' AS type
        , meta->>'idType' AS idType
        , meta->>'allText' AS allText
        , meta->>'idHyperlink' AS idHyperlink
    FROM files file
    CROSS JOIN jsonb_to_recordset(jsonb_extract_path(file.annotations, 'documents')) AS doc(passages JSONB)
    CROSS JOIN jsonb_to_recordset(doc.passages) AS passage(annotations JSONB)
    CROSS JOIN jsonb_to_recordset(passage.annotations) AS annotation(
        uuid VARCHAR
        , keyword VARCHAR
        , meta JSONB
    )
    WHERE
        file.mime_type = 'application/pdf'
) pdf_annotations ON pdf_annotations.file_id = file_ids.id
```

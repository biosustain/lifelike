# Elastic Development

## Kibana

### Annotation
- To seed LMDB data to Kibana:
```bash
./deployment/kibana.sh -a None
# or
docker-compose exec appserver python neo4japp/services/annotations/index_annotations.py -a
```

Then go to `localhost:5601/app/kibana`.

To view the data in Kibana, you need to create Index Patterns on the indices. On the Kibana homepage, scroll down to find `Index Patterns`, click on that. Next click on the button `Create index pattern` and create a pattern for one of the indices. The indices that do not have a patter associated with it should be listed below the input field.

Once all patterns are created, click on the compass icon on the left to start viewing the data.

Example queries:

To filter by specific property: `data.name: lpob` - this will show all data that has `lpob` in the name field.
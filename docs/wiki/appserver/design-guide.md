# AppServer Design Guide

## API Endpoint Design

For API endpoints with **GET** methods that allow further filtering on the general queried resource, there is a standard on how to write the query parameters for the endpoint's URL.

This is the URL scheme for **GET** requests

`localhost:4200/api/<blueprint_url>?fields=<name_of_file>&filters=<name_filter_value>`

In the Flask server, it will parse query parameters into a query dictionary that can use be used to filter down further any resource like below...

```python
fields = request.args.getlist("fields")
fields = fields if len(fields) else ["username"]

filters = request.args.getlist("filters")
filters = filters if len(filters) else [""]

query_dict = dict(zip(fields, filters))
```

They query dictionary will be a flat dictionary in which each key will be mapped to a primitive value like number or string. 

For a field that requires a list of values to filter against such as `coordinates = [x,y]`, then the URL scheme would be formatted to below

`localhost:4200/api/<blueprint_url>?fields=<name_of_file>&filters=<name_filter_value>&coordinates=x&coordinates=y`

 ```python
fields = request.args.getlist("fields")
fields = fields if len(fields) else ["username"]

filters = request.args.getlist("filters")
filters = filters if len(filters) else [""]

coordinates = request.args.getlist("coords")

query_dict = dict(zip(fields, filters))
 ```

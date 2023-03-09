-   [Flask Logging](#flask-logging)
    -   [Overview](#overview)
    -   [How do I add logging to my features?](#how-do-i-add-logging-to-my-features)

# Flask Logging

## Overview

All logs generated are sent to stdout and stderr streams. These logs can be seen in Docker via

```bash
docker logs -f appserver
```

In staging and production, these logs are captured by Filebeat which sends the Docker logs to
Logstash for processing. The ELK stack can currently be found at https://elk.prod.***ARANGO_DB_NAME***.bio.

We're currently using ELK mainly for INFO logs (although its catching all types of levels) at the
moment, and Sentry (sentry.io) for Flask logs for levels ERROR and above.

## How do I add logging to my features?

All logs of level `INFO` and higher will be sent to Logstash. To help Logstash parse the logs, we
add a few convenience classes and functions to convert the log messages into a compatible format.

**Example 1**

Use the `UserEventLog` data class to add a _username_ and _event type_ into the logs. The use of
these data classes are not necessary, but only serve as a reminder as how to format the dictionary
key values. The reason is the Elastic search is indexing on specific key values. There's no harm in
changing these, but some Kibana visualizations may not work as expected if the keys are changed.

-   `event_type` is used as a label for aggregation purposes in Kibana. The example below has
    the `event_type` 'projects create' which can be used as a filter or aggregation point when
    searching through the logs in Kibana.

```python
from neo4japp.constants import LogEventType


@bp.route('/', methods = ['POST'])
def add_projects():
    ...
    user = g.current_user
    ...
    current_app.logger.info(
            f'User created projects: <{projects.project_name}>',
            extra = UserEventLog(
                    username = g.current_user.username,
                    event_type = LogEventType.PROJECT.value
            ).to_dict()
    )
```

**Example 2**

When you don't have the username information, another class `EventLog` can be used in place. Again,
these classes are not necessary and can be easily replaced with a dictionary as
follows: `{event_type='search'}`.

```python
from neo4japp.constants import LogEventType

@bp.route('/viz-search-temp', methods=['POST'])
@jsonify_with_class(SimpleSearchRequest)
def visualizer_search_temp(req: SimpleSearchRequest):
    ...
    current_app.logger.info(
        f'search term: {req.query}',
        extra=EventLog(event_type=LogEventType.VISUALIZER_SEARCH.value).to_dict())

    return SuccessResponse(result=results, status_code=200)
```

**Example 3**

This is to demonstrate that you can call the logger without a message. This will have the message
value `null` and does not require the `extra` parameter.

```python
current_app.logger.info(
        UserEventLog(
                username = user.username,
                event_type = LogEventType.AUTHENTICATION.value
        ).to_dict()
)
```

**Example 4**

The example here shows that we can pass anything into the dictionary. This is useful if we wanted to
add additional information to our logs, but will require some modifications to the indexes in Kibana
if we need to aggregate on the new key values.

```python
current_app.logger.info(
    f'some new log info', extra={'a_new_key': 'a new value!'})
```

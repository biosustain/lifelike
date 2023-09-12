import json
import logging
import re
from contextlib import contextmanager
from datetime import datetime, timedelta
from functools import reduce, wraps
from typing import List, Optional, TypedDict, Any, Dict

from flask import request, has_request_context


class _ServerTimingRecordSnapshot(TypedDict):
    key: str
    duration: timedelta
    description_dict: Dict[str, Any]


def _timedelta_to_ms(td: timedelta):
    return round(td.total_seconds() * 1e3)


def _str_time(td: timedelta):
    return f"{_timedelta_to_ms(td)}ms"


class _ServerTimingRecord:
    key: str
    nested_records: List[_ServerTimingRecordSnapshot]
    duration: timedelta
    _start_time: datetime
    _last_run_duration: timedelta

    def __init__(self, key):
        self.key = key
        self.duration = timedelta()

    @property
    def description_dict(self):
        nested_time = reduce(
            lambda a, b: a + b['duration'], self.nested_records, timedelta()
        )
        nested = dict()
        for record in self.nested_records:
            if record['key'] not in nested:
                nested[record['key']] = timedelta()
            nested[record['key']] += record['duration']
        return {
            'duration': f"{_str_time(self.duration)}",
            'self': f"{_str_time(self.duration - nested_time)}",
            **{key: _str_time(nested[key]) for key in nested},
        }

    @property
    def description(self):
        return f"{self.key}: {json.dumps(self.description_dict)}"

    def __enter__(self):
        self.nested_records = []
        self._start_time = datetime.now()

    def __exit__(self, exc_type, exc_value, traceback):
        self._last_run_duration = datetime.now() - self._start_time
        self.duration += self._last_run_duration
        del self._start_time

    def to_dict(self) -> _ServerTimingRecordSnapshot:
        return {
            'key': self.key,
            'duration': self._last_run_duration,
            'description_dict': self.description_dict,
        }

    def __str__(self):
        key = re.sub(r'\s', '_', self.key)
        duration = _timedelta_to_ms(self.duration)
        description = re.sub(r'[\n\t]', ' ', str(self.description).replace('"', "'"))
        return f'{key};dur={duration};desc="{description}"'


class _RequestContextServerTiming(TypedDict):
    records: List[_ServerTimingRecord]
    current_record: Optional[_ServerTimingRecord]


class ServerTiming:
    """Tool to mesure server side tasks duration and show it in client
    https://sbrgsoftware.atlassian.net/browse/LL-5210
    It provides reasoning on nested tasks and can be used as context manager or decorator.

    Use as context manager:
    with ServerTiming.record('key'):
        do_something()

    or as decorator:
    @ServerTiming.record_call # records ussing function name as key
    def do_something():
        pass

    or as decorator with key:
    @ServerTiming.record_call('key')
    def do_something():
        pass
    """

    metric_enabled: bool = False

    @staticmethod
    def init_app(app):
        if app.config.get('SERVER_TIMING_ENABLED', app.debug):
            ServerTiming.metric_enabled = True
            app.after_request(ServerTiming._add_server_timing_header)

    @staticmethod
    def _add_server_timing_header(response):
        request_context_server_timing = (
            ServerTiming._get_request_context_server_timing()
        )
        records = request_context_server_timing['records']
        if records:
            number_of_digits_in_max_index = len(str(len(records) - 1))
            response.headers['Server-Timing'] = ', '.join(
                map(
                    # putting index with leading zeros to keep order
                    lambda er: f"{str(er[0]).zfill(number_of_digits_in_max_index)}_{er[1]}",
                    enumerate(records),
                )
            )
        return response

    @staticmethod
    def _get_request_context_server_timing() -> _RequestContextServerTiming:
        if not has_request_context():
            logging.warning('Cannot access server timing outside of a request context')

        if not hasattr(request, '_server_timing_record'):
            request._server_timing_record = {
                'records': [],
                'current_record': None,
            }
        return request._server_timing_record

    @staticmethod
    def get_server_timing_record(key, server_timing: _RequestContextServerTiming):
        for record in server_timing['records']:
            if record.key == key:
                return record
        else:
            record = _ServerTimingRecord(key)
            server_timing['records'].append(record)
            return record

    @staticmethod
    @contextmanager
    def record(key):
        if ServerTiming.metric_enabled:
            server_timing = ServerTiming._get_request_context_server_timing()
            record = ServerTiming.get_server_timing_record(key, server_timing)
            previous_record = server_timing['current_record']
            server_timing['current_record'] = record
            with record:
                yield
            if previous_record is not None:
                previous_record.nested_records.append(record.to_dict())
            server_timing['current_record'] = previous_record
        else:
            yield

    @staticmethod
    def record_call(arg=None, key=None):
        if isinstance(arg, str):
            return lambda f: ServerTiming.record_call(f, arg)

        func = arg

        if not ServerTiming.metric_enabled:
            return func

        if key is None:
            key = func.__name__

        @wraps(func)
        def wrapper(*args, **kwargs):
            with ServerTiming.record(key):
                return func(*args, **kwargs)

        return wrapper

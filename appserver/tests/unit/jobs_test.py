from fakeredis import FakeStrictRedis
from pytest import mark
from rq import Queue

from neo4japp.jobs import example_long_calculation_job

# Dummy queue for testing
queue = Queue(is_async=False, connection=FakeStrictRedis())


@mark.skip(reason="Normally skipped as this is for demonstration purposes only")
def test_example_long_calculation_job():
    job = queue.enqueue(example_long_calculation_job, 123, 456)

    assert job.is_finished, 'Always true as the job is enqueued synchronously'
    assert job.result == 279, '123 + 456 should be equal to 279'

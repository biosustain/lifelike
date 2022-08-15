import pytest
from rq import Queue

from neo4japp.factory import create_app
# rq.Queue.enqueue does not seem to play nice with anonymous functions, so we import test jobs
# from a separate module
from neo4japp.jobs import easy_job, hard_job
from neo4japp.services.redis.redis_queue_service import RedisQueueService


@pytest.fixture(scope='session')
def app():
    app = create_app(config='config.Testing')
    app.config.update({"TESTING": True})

    yield app

    # Clean up would normally go here


@pytest.fixture()
def app_context(app):
    """Creates a flask app context"""
    with app.app_context():
        yield app


@pytest.fixture(scope='function')
def rq_service(app_context):
    rq_service = RedisQueueService()

    def cleanup_rq_env():
        # Make sure all queues are killed so we don't have weird counts
        rq_service.delete_all_queues()

        # Kill all workers EXCEPT for the default
        for w in rq_service.get_all_workers():
            if w.name != 'default':
                rq_service.shutdown_worker(w.name)

    # Clean up the redis environment before and after testing the RedisQueueService
    cleanup_rq_env()
    yield rq_service
    cleanup_rq_env()

    # At this point all (non-default) jobs, queues, and workers should be killed! We must be sure
    # to clean up any queue/worker fixtures we create during testing!


@pytest.fixture(scope='function')
def default_queue(rq_service: RedisQueueService):
    q = rq_service.get_queue()

    yield q

    # Make sure the default queue is empty, but not deleted at the end of each test
    q.empty()

    # Also make sure any failed jobs are cleaned up.
    rq_service.cleanup_all_failed_jobs(q.name)


@pytest.fixture(scope='function')
def queue_A(rq_service: RedisQueueService):
    q = rq_service.get_queue(name='queue_A')

    yield q

    q.delete()

    # Also make sure any failed jobs are cleaned up.
    rq_service.cleanup_all_failed_jobs(q.name)


@pytest.fixture(scope='function')
def easy_job_A(rq_service: RedisQueueService, queue_A: Queue):
    yield rq_service.enqueue(
        easy_job,
        queue=queue_A.name,
        job_id='easy_job_A'
    )


@pytest.fixture(scope='function')
def hard_job_A(rq_service: RedisQueueService, queue_A: Queue):
    yield rq_service.enqueue(
        hard_job,
        queue=queue_A.name,
        job_id='hard_job_A'
    )


@pytest.fixture(scope='function')
def worker_A(rq_service: RedisQueueService, queue_A: Queue):
    worker = rq_service.create_worker(
        queues=[queue_A.name],
        name='worker_A'
    )

    yield worker

    rq_service.shutdown_worker(worker.name)

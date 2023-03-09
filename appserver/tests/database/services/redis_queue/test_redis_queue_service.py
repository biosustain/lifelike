from time import sleep

import pytest
from rq import Queue, Worker
from rq.exceptions import NoSuchJobError
from rq.job import Job, JobStatus

from neo4japp.jobs import bad_job, bad_then_good_job
from neo4japp.services.redis.redis_queue_service import RedisQueueService


def test_can_create_rq_service(rq_service: RedisQueueService):
    assert rq_service is not None


def test_can_create_a_new_queue_object(rq_service: RedisQueueService):
    new_q = rq_service.get_queue("my_new_queue")
    assert len(new_q.jobs) == 0

    # Important to note that rq does not seem to actually create the redis queue until the new
    # queue is given a job
    assert len(rq_service.get_all_queues()) == 0


def test_enqueue(rq_service: RedisQueueService, queue_A: Queue):
    assert len(rq_service.get_all_queues()) == 0

    rq_service.enqueue(sum, [1, 2], queue=queue_A.name)

    assert len(rq_service.get_all_queues()) == 1
    assert len(queue_A.jobs) == 1
    assert queue_A.jobs[0].get_status() == JobStatus.QUEUED


def test_can_get_an_existing_queue(rq_service: RedisQueueService, queue_A: Queue):
    assert len(queue_A.jobs) == 0

    rq_service.enqueue(sum, [1, 2], queue=queue_A.name)
    existing_q = rq_service.get_queue(queue_A.name)

    assert len(existing_q.jobs) == 1


def test_get_job_in_queue(
    rq_service: RedisQueueService, queue_A: Queue, easy_job_A: Job
):
    assert rq_service.get_job_in_queue(queue_A.name, easy_job_A.get_id()) == easy_job_A


def test_get_job_in_queue_returns_None_if_job_does_not_exist(
    rq_service: RedisQueueService, queue_A: Queue
):
    rq_service.get_job_in_queue(queue_A.name, "fake_id") is None


def test_get_all_jobs_in_a_queue(
    rq_service: RedisQueueService, queue_A: Queue, easy_job_A: Job
):
    assert len(rq_service.get_all_jobs_in_queue(queue_A.name)) == 1

    rq_service.enqueue(sum, [3, 4], queue=queue_A.name)

    assert len(rq_service.get_all_jobs_in_queue(queue_A.name)) == 2


def test_empty_queue(rq_service: RedisQueueService, queue_A: Queue, easy_job_A: Job):
    assert len(queue_A.jobs) == 1

    rq_service.empty_queue(queue_A.name)

    assert len(queue_A.jobs) == 0


def test_delete_queue(rq_service: RedisQueueService, queue_A: Queue, easy_job_A: Job):
    assert len(rq_service.get_all_queues()) == 1

    rq_service.delete_queue(queue_A.name)

    assert len(rq_service.get_all_queues()) == 0


def test_get_job(rq_service: RedisQueueService, easy_job_A: Job):
    assert rq_service.get_job(easy_job_A.get_id()) == easy_job_A


def test_get_job_throws_if_job_does_not_exist(rq_service: RedisQueueService):
    with pytest.raises(NoSuchJobError):
        rq_service.get_job("i_dont_exist")


def test_get_worker_with_existing_queue(rq_service: RedisQueueService, queue_A: Queue):
    new_worker = rq_service.create_worker(queues=[queue_A.name], name="new_worker")

    assert new_worker is not None
    assert new_worker.name == "new_worker"
    assert new_worker.queue_names() == [queue_A.name]

    # Recall that queues are not registered until they are given a job!
    assert len(rq_service.get_all_queues()) == 0


def test_get_worker_with_new_queue(rq_service: RedisQueueService):
    new_worker = rq_service.create_worker(queues=["new_queue"], name="new_worker")

    assert new_worker is not None
    assert new_worker.name == "new_worker"
    assert new_worker.queue_names() == ["new_queue"]

    # Recall that queues are not registered until they are given a job!
    assert len(rq_service.get_all_queues()) == 0


def test_get_existing_worker(rq_service: RedisQueueService, worker_A: Worker):
    assert (
        rq_service.create_worker(queues=worker_A.queue_names(), name=worker_A.name)
        == worker_A
    )


def test_get_existing_worker_with_different_queues(
    rq_service: RedisQueueService, worker_A: Worker
):
    # This test is intended to show that creating a "new" worker with the name of an existing
    # worker has some unexpected behavior. It seems that once a worker has started working, there
    # is NOT any way to update which queues it reads from! See the
    # `test_start_worker_with_existing_name` test below.
    new_worker_A = rq_service.create_worker(queues=["fake_queue"], name=worker_A.name)
    assert new_worker_A == worker_A
    assert new_worker_A.queue_names() != worker_A.queue_names()


def test_start_worker(queue_A: Queue, easy_job_A: Job, worker_A: Worker):
    assert len(queue_A.jobs) == 1
    assert queue_A.fetch_job(easy_job_A.id) == easy_job_A
    assert easy_job_A.get_status() == JobStatus.QUEUED

    worker_A.work(burst=True)

    assert len(queue_A.jobs) == 0
    assert easy_job_A.get_status() == JobStatus.FINISHED
    assert easy_job_A.result == sum([i for i in range(0, 10)])


def test_start_worker_with_existing_name_throws(
    rq_service: RedisQueueService, default_queue: Queue, queue_A: Queue
):
    with pytest.raises(ValueError):
        queue_A.enqueue(sum, [1, 2], max_retry=None, failure_ttl=0)
        new_default = rq_service.create_worker(
            queues=[queue_A.name], name=default_queue.name
        )
        new_default.work(burst=True)


def test_rq_service_can_get_all_workers(
    rq_service: RedisQueueService,
):
    all_workers = rq_service.get_all_workers()
    assert len(all_workers) == 1
    assert all_workers[0].name == "default"


def test_rq_service_get_a_count_of_all_workers(rq_service: RedisQueueService):
    assert rq_service.get_worker_count() == 1


@pytest.mark.skip(
    "Skipping this to avoid CI failing. Sleeping leads to non-deterministic execution which "
    + "can cause tests to fail."
)
def test_get_failed_jobs(rq_service: RedisQueueService, default_queue: Queue):
    rq_service.enqueue(
        bad_job,
        max_retry=None,
        queue=default_queue.name,
        job_id="bad_job",
    )

    # Wait a second for the default worker to try the bad job
    sleep(1)

    assert len(rq_service.get_failed_jobs(queue=default_queue.name)) == 1


@pytest.mark.skip(
    "Skipping this to avoid CI failing. Sleeping leads to non-deterministic execution which "
    + "can cause tests to fail."
)
def test_cleanup_failed_job(rq_service: RedisQueueService, default_queue: Queue):
    rq_service.enqueue(
        bad_job,
        max_retry=None,
        queue=default_queue.name,
        job_id="bad_job_to_cleanup",
    )

    # Wait a second for the default worker to try the bad job
    sleep(1)

    failed_jobs = rq_service.get_failed_jobs(queue=default_queue.name)

    assert len(failed_jobs) == 1

    rq_service.cleanup_failed_job(default_queue.name, failed_jobs[0].id)

    assert len(rq_service.get_failed_jobs(queue=default_queue.name)) == 0


@pytest.mark.skip(
    "Skipping this to avoid CI failing. Sleeping leads to non-deterministic execution which "
    + "can cause tests to fail."
)
def test_retry_failed_jobs(rq_service: RedisQueueService, default_queue: Queue):
    rq_service.enqueue(
        bad_then_good_job,
        max_retry=None,
        queue=default_queue.name,
        job_id="bad_then_good_job",
    )

    # Wait a second for the default worker to try the job
    sleep(1)

    assert len(rq_service.get_failed_jobs(queue=default_queue.name)) == 1
    rq_service.retry_failed_jobs(default_queue.name)
    assert len(rq_service.get_failed_jobs(queue=default_queue.name)) == 0

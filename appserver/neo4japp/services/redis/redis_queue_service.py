from datetime import datetime
from flask import current_app
from rq import Queue, Retry, Worker
from rq.command import send_shutdown_command
from rq.job import Job
from rq.registry import FailedJobRegistry
from typing import Iterable

from neo4japp.constants import LogEventType
from neo4japp.database import get_redis_connection


class RedisQueueService():
    def __init__(self):
        super().__init__()
        self._redis_conn = get_redis_connection()

    def get_queue(self, name='default') -> Queue:
        return Queue(name, connection=self._redis_conn)

    def get_all_queues(self) -> Iterable[Queue]:
        return Queue.all(connection=self._redis_conn)

    def enqueue(self, f, *args, queue='default', max_retry=10, retry_interval=60, **kwargs) -> Job:
        q = self.get_queue(queue)

        retry = Retry(max=max_retry, interval=retry_interval) if max_retry is not None else None

        job = q.enqueue(f, *args, retry=retry, **kwargs)
        current_app.logger.info(
            f'Job enqueued to redis.',
            extra={'event_type': LogEventType.REDIS, 'job': job.to_dict()}
        )
        return job

    def empty_queue(self, queue: str) -> int:
        retval = self.get_queue(queue).empty()
        current_app.logger.info(
            f'Redis queue {queue} emptied.',
            extra={'event_type': LogEventType.REDIS}
        )
        return retval

    def delete_queue(self, queue: str, delete_jobs=True):
        self.get_queue(queue).delete(delete_jobs)
        current_app.logger.info(
            f'Redis queue {queue} deleted.',
            extra={'event_type': LogEventType.REDIS}
        )

    def delete_all_queues(self):
        for q in Queue.all(connection=self._redis_conn):
            self.delete_queue(q.name)

    def get_job_in_queue(self, queue: str, job_id) -> Job:
        job = self.get_queue(queue).fetch_job(job_id)
        if job is not None:
            current_app.logger.info(
                f'Job fetched from queue {queue}.',
                extra={'event_type': LogEventType.REDIS, 'job': job.to_dict()}
            )
        return job

    def get_all_jobs_in_queue(self, queue: str) -> Iterable[Job]:
        jobs = self.get_queue(queue).jobs
        for job in jobs:
            current_app.logger.info(
                f'Job fetched from queue {queue}.',
                extra={'event_type': LogEventType.REDIS, 'job': job.to_dict()}
            )
        return jobs

    def get_job(self, job_id) -> Job:
        job = Job.fetch(job_id, connection=self._redis_conn)
        if job is not None:
            current_app.logger.info(
                f'Job fetched.',
                extra={'event_type': LogEventType.REDIS, 'job': job.to_dict()}
            )
        return job

    def create_worker(self, queues, name, **kwargs) -> Worker:
        worker = Worker(
            queues=queues,
            name=name,
            connection=self._redis_conn,
            **kwargs
        )
        current_app.logger.info(
            f'Redis worker {worker.name} created.',
            extra={'event_type': LogEventType.REDIS}
        )
        return worker

    def get_worker(self, name) -> Worker:
        for w in Worker.all(connection=self._redis_conn):
            if w.name == name:
                current_app.logger.info(
                    f'Redis worker {w.name} fetched.',
                    extra={'event_type': LogEventType.REDIS}
                )
                return w

    def get_all_workers(self) -> Iterable[Worker]:
        workers = Worker.all(connection=self._redis_conn)
        current_app.logger.info(
            f'Redis workers fetched: {[w.name for w in workers]}.',
            extra={'event_type': LogEventType.REDIS}
        )
        return workers

    def get_worker_count(self) -> int:
        return Worker.count(connection=self._redis_conn)

    def get_queue_workers(self, queue: str) -> Iterable[Worker]:
        q = self.get_queue(queue)
        queue_workers = Worker.all(queue=q)
        current_app.logger.info(
            f'Redis queue {queue} workers fetched: {[w.name for w in queue_workers]}.',
            extra={'event_type': LogEventType.REDIS}
        )
        return queue_workers

    def shutdown_worker(self, worker_name: str):
        current_app.logger.info(
            f'Redis worker {worker_name} shut down.',
            extra={'event_type': LogEventType.REDIS}
        )
        send_shutdown_command(self._redis_conn, worker_name)

    def shutdown_all_workers(self):
        for w in Worker.all(connection=self._redis_conn):
            self.shutdown_worker(w.name)

    def get_failed_job_registry(self, queue) -> FailedJobRegistry:
        q = self.get_queue(queue)
        return FailedJobRegistry(queue=q)

    def get_failed_jobs(self, queue: str) -> Iterable[Job]:
        # Note that with our current configuration, failed jobs are immediately retried several
        # times. So, this list represents all jobs that did not succeed after being retried!
        registry = self.get_failed_job_registry(queue)
        return [self.get_job(job_id) for job_id in registry.get_job_ids()]

    def log_failed_jobs(self, queue: str):
        for job in self.get_failed_jobs(queue):
            current_app.logger.info(
                f'Failed Redis job {job.id}.',
                extra={'event_type': LogEventType.REDIS, 'job': job.to_dict()}
            )

    def retry_failed_jobs(self, queue: str):
        registry = self.get_failed_job_registry(queue)
        for job in self.get_failed_jobs(queue):
            registry.requeue(job)
            current_app.logger.info(
                f'Failed Redis Job {job.id} requeued.',
                extra={'event_type': LogEventType.REDIS, 'job': job.to_dict()}
            )

    def cleanup_failed_job(self, queue: str, job_id: str):
        registry = self.get_failed_job_registry(queue)
        failed_job = self.get_job(job_id)
        registry.remove(failed_job)

        current_app.logger.info(
            f'Failed Redis job {failed_job.id} removed.',
            extra={'event_type': LogEventType.REDIS, 'job': failed_job.to_dict()}
        )

    def cleanup_all_failed_jobs(self, queue: str):
        registry = self.get_failed_job_registry(queue)
        for job in self.get_failed_jobs(queue):
            registry.remove(job)
            current_app.logger.info(
                f'Failed Redis job {job.id} removed.',
                extra={'event_type': LogEventType.REDIS, 'job': job.to_dict()}
            )

    # Note that expired jobs are automatically cleaned up when calling certain helpers of the failed
    # job registry, the `get_job_ids` method for example.
    def cleanup_expired_failed_jobs(self, queue: str, timestamp=None):
        registry = self.get_failed_job_registry(queue)
        registry.cleanup(timestamp)

        timestamp_str = (
            timestamp if timestamp is not None
            else datetime.now().strftime("%Y-%m-%d %I:%M %p")
        )
        current_app.logger.info(
            f'Failed Redis jobs in queue {queue} expired before {timestamp_str} removed.',
            extra={'event_type': LogEventType.REDIS}
        )

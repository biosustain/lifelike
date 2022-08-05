from flask import current_app
from rq import Queue, Retry, Worker
from rq.command import send_shutdown_command
from rq.job import Job
from rq.registry import FailedJobRegistry
from typing import Iterable

from neo4japp.database import get_redis_connection


class RedisQueueService():
    def __init__(self):
        super().__init__()
        self._redis_conn = get_redis_connection()

    def get_queue(self, name='default') -> Queue:
        return Queue(name, connection=self._redis_conn)

    def get_all_queues(self) -> Iterable[Queue]:
        return Queue.all(connection=self._redis_conn)

    def enqueue(self, f, queue='default', *args, **kwargs) -> Job:
        q = self.get_queue(queue)
        job = q.enqueue(f, retry=Retry(max=1, interval=60), *args, **kwargs)
        current_app.logger.info(f'Job enqueued to redis: {job.to_dict()}')
        return job

    def empty_queue(self, queue: str) -> int:
        retval = self.get_queue(queue).empty()
        current_app.logger.info(f'Redis queue {queue} emptied')
        return retval

    def delete_queue(self, queue: str, delete_jobs=True):
        self.get_queue(queue).delete(delete_jobs)
        current_app.logger.info(f'Redis queue {queue} deleted')

    def delete_all_queues(self):
        for q in Queue.all(connection=self._redis_conn):
            self.delete_queue(q.name)

    def get_job_in_queue(self, queue: str, job_id) -> Job:
        job = self.get_queue(queue).fetch_job(job_id)
        current_app.logger.info(f'Job fetched from queue {queue}: {job.to_dict()}')
        return job

    def get_all_jobs_in_queue(self, queue: str) -> Iterable[Job]:
        jobs = self.get_queue(queue).jobs
        for job in jobs:
            current_app.logger.info(f'Job fetched from queue {queue}: {job.to_dict()}')
        return jobs

    def get_job(self, job_id) -> Job:
        job = Job.fetch(job_id, connection=self._redis_conn)
        current_app.logger.info(f'Job fetched: {job.to_dict()}')
        return job

    def create_worker(self, queues, name, **kwargs) -> Worker:
        worker = Worker(
            queues=queues,
            name=name,
            connection=self._redis_conn,
            **kwargs
        )
        current_app.logger.info(f'Redis worker {worker.name} created')
        return worker

    def get_worker(self, name) -> Worker:
        for w in Worker.all(connection=self._redis_conn):
            if w.name == name:
                current_app.logger.info(f'Redis worker {w.name} fetched')
                return w

    def get_all_workers(self) -> Iterable[Worker]:
        workers = Worker.all(connection=self._redis_conn)
        current_app.logger.info(f'Redis workers fetched: {[w.name for w in workers]}')
        return workers

    def get_worker_count(self) -> int:
        return Worker.count(connection=self._redis_conn)

    def get_queue_workers(self, queue: str) -> Iterable[Worker]:
        q = self.get_queue(queue)
        queue_workers = Worker.all(queue=q)
        current_app.logger.info(
            f'Redis queue {queue} workers fetched: {[w.name for w in queue_workers]}'
        )
        return queue_workers

    def shutdown_worker(self, worker_name: str):
        current_app.logger.info(f'Redis worker {worker_name} shut down')
        send_shutdown_command(self._redis_conn, worker_name)

    def shutdown_all_workers(self):
        for w in Worker.all(connection=self._redis_conn):
            self.shutdown_worker(w.name)

    def get_failed_jobs(self, queue: str) -> Iterable[Job]:
        q = self.get_queue(queue)

        # Note that with our current configuration, failed jobs are immediately retried several
        # times. So, this list represents all jobs that did not succeed after being retried!
        registry = FailedJobRegistry(queue=q)
        return [self.get_job(job_id) for job_id in registry.get_job_ids()]

    def log_failed_jobs(self, queue: str):
        for job in self.get_failed_jobs(queue):
            current_app.logger.info(f'Failed Redis Job {job.id}: {job.exc_info}')

    def retry_failed_jobs(self, queue: str):
        q = self.get_queue(queue)
        registry = FailedJobRegistry(queue=q)
        for job in self.get_failed_jobs(queue):
            registry.requeue(job)
            current_app.logger.info(f'Failed Redis Job {job.id} requeued')

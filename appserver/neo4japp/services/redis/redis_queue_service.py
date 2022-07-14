from rq import Queue, Worker
from rq.command import send_shutdown_command
from rq.job import Job
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
        return q.enqueue(f, *args, **kwargs)

    def empty_queue(self, queue: str) -> int:
        return self.get_queue(queue).empty()

    def delete_queue(self, queue: str, delete_jobs=True):
        self.get_queue(queue).delete(delete_jobs)

    def delete_all_queues(self):
        for q in Queue.all(connection=self._redis_conn):
            self.delete_queue(q.name)

    def get_job_in_queue(self, queue: str, job_id) -> Job:
        return self.get_queue(queue).fetch_job(job_id)

    def get_all_jobs_in_queue(self, queue: str) -> Iterable[Job]:
        return self.get_queue(queue).jobs

    def get_job(self, job_id) -> Job:
        return Job.fetch(job_id, connection=self._redis_conn)

    def create_worker(self, queues, name, **kwargs) -> Worker:
        return Worker(
            queues=queues,
            name=name,
            connection=self._redis_conn,
            **kwargs
        )

    def get_worker(self, name) -> Worker:
        for w in Worker.all(connection=self._redis_conn):
            if w.name == name:
                return w

    def get_all_workers(self) -> Iterable[Worker]:
        return Worker.all(connection=self._redis_conn)

    def get_worker_count(self) -> int:
        return Worker.count(connection=self._redis_conn)

    def get_queue_workers(self, queue: str) -> Iterable[Worker]:
        q = self.get_queue(queue)
        return Worker.all(queue=q)

    def shutdown_worker(self, worker_name: str):
        send_shutdown_command(self._redis_conn, worker_name)

    def shutdown_all_workers(self):
        for w in Worker.all(connection=self._redis_conn):
            self.shutdown_worker(w.name)

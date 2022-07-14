
def example_long_calculation_job(x: int, y: int) -> int:
    """
    This example function can be invoked from anywhere as follows: long_calculation.queue(x, y)
    It will return immediately and it will be queued for a separate worker process to execute.

    Example (using a flask shell for demonstration purposes):
        $ flask shell
        >>> from neo4japp.services.redis.redis_queue_service import RedisQueueService
        >>> from neo4japp.jobs import example_long_calculation_job
        >>> rq_service = RedisQueueService()
        >>> rq_service.enqueue(
            example_long_calculation_job,
            'default',
            123, 456,
            job_id='example_long_calculation_job'
        )
        Job('example_long_calculation_job', ...)

    Jobs will be queued until a worker process them. To launch a worker process, run:
        $ rq worker

    To monitor queues and job status, run:
        $ rq info -u redis://default:password@localhost:6379/1

    See the full docs: https://python-rq.org/docs/
    """
    from time import sleep
    from random import random

    time = random() * 10
    print(f"Sleeping for {time} seconds to simulate a long running calculation...")
    sleep(time)

    return x + y

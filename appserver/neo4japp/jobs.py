from flask_rq2 import RQ

rq = RQ()


@rq.job
def example_long_calculation_job(x: int, y: int) -> int:
    """
    This example function can be invoked from anywhere as follows: long_calculation.queue(x, y)
    It will return immediately and it will be queued for a separate worker process to execute.

    Example (using a flask shell for demonstration purposes):
        $ flask shell
        >>> from neo4japp.jobs import example_long_calculation_job
        >>> example_long_calculation_job.queue(123, 456)
        FlaskJob('e697a984-b38c-4521-a78f-f6fce81a7a5c', enqueued_at=...)

    Jobs will be queued until a worker process them. To launch a worker process, run:
        $ flask rq worker

    To monitor queues and job status, run:
        $ flask rq info

    See the full docs: https://flask-rq2.readthedocs.io
    """
    from time import sleep
    from random import random

    time = random() * 10
    print(f"Sleeping for {time} seconds to simulate a long running calculation...")
    sleep(time)

    return x + y

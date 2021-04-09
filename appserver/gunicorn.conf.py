import multiprocessing

bind = '0.0.0.0:5000'
workers = multiprocessing.cpu_count() * 2 + 1
threads = 12
timeout = 60 * 20  # seconds
loglevel = 'debug'
accesslog = 'gunicorn-access-log.txt'
errorlog = 'gunicorn-error-log.txt'
capture_output = True

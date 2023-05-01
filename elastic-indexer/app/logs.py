import logging
import os

DEFAULT_LOG_LEVEL = logging.DEBUG


def get_logger() -> logging.Logger:
    logging.basicConfig()
    logger = logging.getLogger('Elastic-Indexer')
    log_level = getattr(
        logging,
        os.environ.get('LOG_LEVEL', 'DEBUG').upper(),
        DEFAULT_LOG_LEVEL
    )
    logger.setLevel(log_level)
    logger.info(f'Set log level to {log_level}')
    return logger

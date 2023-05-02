import logging
import os

DEFAULT_LOG_LEVEL = logging.DEBUG


def get_logger_extras_obj(event_type: str, **kwargs) -> dict:
    return {
        'event_type': event_type,
        **kwargs
    }


def get_annotator_extras_obj() -> dict:
    return get_logger_extras_obj(event_type='annotations')


def get_logger() -> logging.Logger:
    logging.basicConfig()
    logger = logging.getLogger('Annotator')
    log_level = getattr(
        logging,
        os.environ.get('LOG_LEVEL', 'DEBUG').upper(),
        DEFAULT_LOG_LEVEL
    )
    logger.setLevel(log_level)
    logger.info(f'Set log level to {log_level}')
    return logger

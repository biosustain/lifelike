
import logging
import logging.handlers
import sys

import coloredlogs

from arg_parser import arg_parser

_LOG_FORMAT = '%(asctime)s %(levelname)s %(message)s'
_LOG_MAX_SIZE = 1024 * 1024
_LOG_MAX_FILES = 5


def setup_logging(args):
    """
    Setup logging.
    """
    coloredlogs.install(fmt=_LOG_FORMAT, level=args.log_level)

    root_log = logging.getLogger()
    if args.log_file is not None:
        handler = logging.handlers.RotatingFileHandler(
            filename=args.log_file, maxBytes=_LOG_MAX_SIZE, backupCount=_LOG_MAX_FILES
        )
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))

        root_log.addHandler(handler)

    return root_log


def main(argv):
    """
    Main entry point.
    """
    args = arg_parser.parse_args(argv)

    logger = setup_logging(args)
    logger.info(
        'Executing '
        + __file__
        + ' with arguments: '
        + ', '.join(['%s=%s' % (key, value) for (key, value) in args.__dict__.items()])
    )

    args.func(args)


if __name__ == '__main__':
    main(sys.argv[1:])

from . import literature_data_parser


def setup_arg_parser(parser):
    parser.set_defaults(func=literature_data_parser.main)

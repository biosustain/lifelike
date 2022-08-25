from . import regulondb_parser


def setup_arg_parser(parser):
    parser.set_defaults(func=regulondb_parser.main)

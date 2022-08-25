from . import enzyme_parser


def setup_arg_parser(parser):
    parser.set_defaults(func=enzyme_parser.main)

from . import go_parser


def setup_arg_parser(parser):
    parser.set_defaults(func=go_parser.main)

from . import stringdb_parser


def setup_arg_parser(parser):
    parser.add_argument('--output-file', required=True)
    parser.set_defaults(func=stringdb_parser.main)

from . import chebi_parser


def setup_arg_parser(parser):
    parser.set_defaults(func=chebi_parser.main)

from . import uniprot_parser


def setup_arg_parser(parser):
    parser.set_defaults(func=uniprot_parser.main)

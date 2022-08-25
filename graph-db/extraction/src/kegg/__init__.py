from . import kegg_parser


def setup_arg_parser(parser):
    parser.set_defaults(func=kegg_parser.main)

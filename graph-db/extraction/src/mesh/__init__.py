from . import mesh_parser


def setup_arg_parser(parser):
    parser.set_defaults(func=mesh_parser.main)

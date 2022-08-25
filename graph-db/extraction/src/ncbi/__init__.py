from . import ncbi_gene_parser, taxonomy_parser


def setup_arg_parser(parser):
    subparsers = parser.add_subparsers(dest='part', required=True)
    subparsers\
        .add_parser('gene')\
        .set_defaults(func=ncbi_gene_parser.main)
    subparsers\
        .add_parser('taxonomy')\
        .set_defaults(func=taxonomy_parser.main)


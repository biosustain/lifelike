from .parsers import biocyc_parser


def setup_arg_parser(parser):
    parser.add_argument(
        '--data-sources',
        nargs='*',
        required=True,
        help='A list of data sources to load, e.g. PseudomonasCyc YeastCyc EcoCyc HumanCyc',
    )
    parser.set_defaults(func=biocyc_parser.main)

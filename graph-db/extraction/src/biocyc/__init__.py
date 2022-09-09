import argparse

from . import biocyc_liquibase
from .config import BiocycConfig
from .parsers import biocyc_parser


def biocyc(args):
    biocyc_parser.main(args)
    biocyc_liquibase.main(args)


def comma_sep_list(data):
    return data.split(',')


def comma_sep_choice_list(choices):
    def check_choices(data):
        chs = comma_sep_list(data)
        for ch in chs:
            if ch not in choices:
                raise argparse.ArgumentTypeError(
                    'The argument id_prefix must be the JIRA card number; e.g LL-1234'
                )
        else:
            return chs

    return check_choices


def setup_arg_parser(parser):
    parser.add_argument(
        '--data-sources',
        required=True,
        help='A list of comma separated data sources to load, e.g. PseudomonasCyc,YeastCyc,EcoCyc,HumanCyc',
        type=comma_sep_choice_list(choices=BiocycConfig().dbnames)
    )
    parser.add_argument(
        '--author',
        required=False
    )
    parser.set_defaults(func=biocyc)
    step_parser = parser.add_subparsers(
        title='step',
        dest='step',
        required=False
    )
    parse_parser = step_parser.add_parser('parse')
    parse_parser.set_defaults(func=biocyc_parser.main)
    liquibase_parser = step_parser.add_parser('liquibase')
    liquibase_parser.set_defaults(func=biocyc_liquibase.main)
    liquibase_parser.add_argument(
        '--zip-datafile',
        required=False
    )
    liquibase_parser.add_argument(
        '--author',
        required=True
    )

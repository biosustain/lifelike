
import argparse
import re
from re import Pattern
from pathlib import Path


# noinspection PyPep8Naming
def Regex(arg_value, pat: Pattern):
    """
    Validate that the argument matches the given regex.
    """
    if not pat.match(arg_value):
        raise argparse.ArgumentTypeError(f'{arg_value} does not match {pat}')
    return arg_value


LL_Regex = re.compile(r"^LL-\d+$")


# noinspection PyPep8Naming
def LL_Ticket(arg_value):
    """
    Validate that the argument is a valid LL ticket.
    """
    try:
        return Regex(arg_value, LL_Regex)
    except argparse.ArgumentTypeError:
        raise argparse.ArgumentTypeError(
            'The argument id_prefix must be the JIRA card number; e.g LL-1234'
        )


arg_parser = argparse.ArgumentParser()

arg_parser.add_argument(
    '--log-file',
    help='Append log messages to file; files are rotated at 1MB',
    type=Path,
)
arg_parser.add_argument(
    '--log-level',
    default='INFO',
    choices=('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'),
)
arg_parser.add_argument(
    '--prefix',
    help='The JIRA card numeric number; e.g LL-1234',
    required=True,
    type=LL_Ticket
)

subparser = arg_parser.add_subparsers(dest='domain', required=True)
biocyc_parser = subparser.add_parser('biocyc')
biocyc_parser.add_argument(
    '--data-sources',
    nargs='*',
    required=True,
    help='A list of data sources to load, e.g. PseudomonasCyc YeastCyc EcoCyc HumanCyc',
)

# parsers with no additional arguments
subparser.add_parser('chebi')
subparser.add_parser('enzyme')
subparser.add_parser('go')
subparser.add_parser('kegg')
subparser.add_parser('mesh')
subparser.add_parser('mesh-add-disease-synonyms')
subparser.add_parser('mesh-annotations')
subparser.add_parser('ncbi-gene')
subparser.add_parser('ncbi-taxonomy')
subparser.add_parser('regulondb')
subparser.add_parser('stringdb')
subparser.add_parser('uniprot')
subparser.add_parser('zenodo-literature')

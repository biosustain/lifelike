
import argparse
import importlib
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

domain_arg_parser = arg_parser.add_subparsers(
    title='domain',
    dest='domain',
    required=True
)

for module in ['biocyc', 'chebi', 'enzyme', 'go', 'kegg', 'mesh', 'ncbi', 'regulondb', 'stringdb', 'uniprot', 'zenodo-literature']:
    importlib.import_module(module).setup_arg_parser(domain_arg_parser.add_parser(module))

# biocyc_parser = domain_arg_parser.add_parser('biocyc')
# biocyc_parser.add_argument(
#     '--data-sources',
#     nargs='*',
#     required=True,
#     help='A list of data sources to load, e.g. PseudomonasCyc YeastCyc EcoCyc HumanCyc',
# )
#
# # parsers with no additional arguments
# domain_arg_parser.add_parser('chebi')
# domain_arg_parser.add_parser('enzyme')
# domain_arg_parser.add_parser('go')
# domain_arg_parser.add_parser('kegg')
# domain_arg_parser.add_parser('mesh')
# domain_arg_parser.add_parser('mesh-add-disease-synonyms')
# domain_arg_parser.add_parser('mesh-annotations')
# domain_arg_parser.add_parser('ncbi-gene')
# domain_arg_parser.add_parser('ncbi-taxonomy')
# domain_arg_parser.add_parser('regulondb')
# domain_arg_parser.add_parser('stringdb')
# domain_arg_parser.add_parser('uniprot')
# domain_arg_parser.add_parser('zenodo-literature')

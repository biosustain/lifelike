
import logging
import logging.handlers
import sys

import coloredlogs

from arg_parser import arg_parser

import biocyc.biocyc_parser as biocyc_parser
import chebi.chebi_parser as chebi_parser
import enzyme.enzyme_parser as enzyme_parser
import go.go_parser as go_parser
import kegg.kegg_parser as kegg_parser
import mesh.mesh_parser as mesh_parser
import mesh.add_disease_synonyms_by_pruning_disease as add_disease_synonyms_by_pruning_disease
import mesh.mesh_annotations as mesh_annotations
import ncbi.ncbi_gene_parser as ncbi_gene_parser
import ncbi.taxonomy_parser as ncbi_taxonomy_parser
import literature.literature_data_parser as literature_data_parser
import regulondb.regulondb_parser as regulondb_parser
import stringdb.stringdb_parser as stringdb_parser
import uniprot.uniprot_parser as uniprot_parser

_LOG_FORMAT = '%(asctime)s %(levelname)s %(message)s'
_LOG_MAX_SIZE = 1024 * 1024
_LOG_MAX_FILES = 5

DOMAIN_PARSERS = {
    'biocyc': biocyc_parser,
    'chebi': chebi_parser,
    'enzyme': enzyme_parser,
    'go': go_parser,
    'kegg': kegg_parser,
    'mesh': mesh_parser,
    'mesh-add-disease-synonyms': add_disease_synonyms_by_pruning_disease,
    'mesh-annotations': mesh_annotations,
    'ncbi-gene': ncbi_gene_parser,
    'ncbi-taxonomy': ncbi_taxonomy_parser,
    'regulondb': regulondb_parser,
    'stringdb': stringdb_parser,
    'uniprot': uniprot_parser,
    'zenodo-literature': literature_data_parser
}


def setup_logging(args):
    """
    Setup logging.
    """
    coloredlogs.install(fmt=_LOG_FORMAT, level=args.log_level)

    ***ARANGO_USERNAME***_log = logging.getLogger()
    if args.log_file is not None:
        handler = logging.handlers.RotatingFileHandler(
            filename=args.log_file, maxBytes=_LOG_MAX_SIZE, backupCount=_LOG_MAX_FILES
        )
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))

        ***ARANGO_USERNAME***_log.addHandler(handler)

    return ***ARANGO_USERNAME***_log


def main(argv):
    """
    Main entry point.
    """
    args = arg_parser.parse_args(argv)

    logger = setup_logging(args)
    logger.info(
        'Executing '
        + __file__
        + ' with arguments: '
        + ', '.join(['%s=%s' % (key, value) for (key, value) in args.__dict__.items()])
    )

    # get parser function using args.domain
    parser = DOMAIN_PARSERS[args.domain]

    # call main function and pass arguments
    parser.main(args)


if __name__ == '__main__':
    main(sys.argv[1:])

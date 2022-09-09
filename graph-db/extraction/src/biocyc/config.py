import tarfile
from functools import cached_property

import os

from common.constants import *
from config.config import Config

DEFAULT_ENTITIES = [
    NODE_SPECIES, NODE_CLASS, NODE_COMPOUND, NODE_DNA_BINDING_SITE,
    NODE_GENE, NODE_TERMINATOR, NODE_PROMOTER,
    NODE_TRANS_UNIT, NODE_RNA, NODE_PROTEIN,
    NODE_REACTION, NODE_PATHWAY,
    NODE_ENZ_REACTION,
    NODE_REGULATION,
    # NODE_PRIMARY
]

class BiocycConfig(Config):
    @cached_property
    def dbnames(self):
        return super().content.keys()

    def __init__(self, dbname=None):
        super().__init__(os.path.abspath(os.path.dirname(__file__)))
        self.dbname = dbname

    @cached_property
    def data_output_zip(self):
        return f"{self.dbname}-data-{self.version}.zip"

    @cached_property
    def version(self):
        """
        find the latest version of data in the tar file.  Sometimes a tar file has multiple version data.
        :param tar:
        :return:
        """
        tar_file = os.path.join(Config().data_dir, 'download', DB_BIOCYC.lower(), self['data'])
        with tarfile.open(tar_file, mode='r:gz') as tar:
            versions = {}
            for file in tar.getmembers():
                data_path = os.path.sep + 'data'
                if data_path in file.name:
                    sub = file.name.split(data_path)[0]
                    paths = sub.split(os.path.sep)
                    version = paths[-1]
                    versions[float(version)] = version
            maxkey = max(versions.keys())
            version = versions[maxkey]
            # todo: self.logger.info(f'Database file version: "{self.version}"')
            return version

    @cached_property
    def content(self):
        return super(BiocycConfig, self).content[self.dbname]

    def _get_data_dir(self):
        datadir = self.content['directories']['dataDirectory']
        if datadir.startswith('/'):
            return datadir
        cwd = os.path.abspath(os.path.dirname(__file__))
        datadir = os.path.abspath(os.path.join(cwd, datadir))
        return datadir

    @cached_property
    def entities(self):
        return DEFAULT_ENTITIES + self.content.get('extraParsers', [])

    def __getitem__(self, item):
        return self.content[item]

    def get_changelog_template_dir(self):
        return os.path.join(self.config_dir, 'templates')

    def get_cypher_dir(self):
        return os.path.join(self.config_dir, 'cypher')

    def get_biocyc_cyphers(self):
        return self.read_yaml(os.path.join(self.get_cypher_dir(), 'biocyc-cypher.yml'))

    def get_string_cyphers(self):
        return self.read_yaml(os.path.join(self.get_cypher_dir(), 'string-cypher.yml'))

    def get_taxonomy_cyphers(self):
        return self.read_yaml(os.path.join(self.get_cypher_dir(), 'taxonomy-cypher.yml'))

    def get_synonym_cyphers(self):
        return self.read_yaml(os.path.join(self.get_cypher_dir(), 'synonym-cypher.yml'))











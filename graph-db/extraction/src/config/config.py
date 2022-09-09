from functools import cached_property

import yaml
import os


class Config:
    def __init__(self, cwd=None):
        cwd = cwd or os.path.abspath(os.path.dirname(__file__))
        self.config_dir = os.path.join(cwd, '')

    @cached_property
    def content(self):
        config_file = os.path.join(self.config_dir, 'config.yml')
        content = self.read_yaml(config_file)
        return content

    @classmethod
    def read_yaml(cls, yaml_file):
        content = None
        with open(yaml_file, 'r') as stream:
            try:
                content = yaml.safe_load(stream)
            except yaml.YAMLError as err:
                raise yaml.YAMLError("The yaml file {} could not be parsed. {}".format(yaml_file, err))
        return content

    @cached_property
    def data_dir(self):
        datadir = self.content['directories']['dataDirectory']
        if datadir.startswith('/'):
            return datadir
        cwd = os.path.abspath(os.path.dirname(__file__))
        datadir = os.path.abspath(os.path.join(cwd, datadir))
        return datadir

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











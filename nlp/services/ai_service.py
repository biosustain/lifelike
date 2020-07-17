import os

from enum import Enum

import tensorflow as tf
import nltk
import numpy as np


# these are used across the app so
# putting here to be consistent
class EntityType(Enum):
    Chemical = 'Chemical'
    Compound = 'Compound'
    Disease = 'Disease'
    Gene = 'Gene'
    Protein = 'Protein'
    Species = 'Species'
    Phenotype = 'Phenotype'


class AIService():
    MODEL_DIRECTORY = '/models/'
    ALL_MODELS = [
        {'path': 'bacteria/v1/model/1/', 'type': 'Bacteria'},  # TODO: this becomes species later?
        {'path': 'chemical/v1/model', 'type': EntityType.Chemical.value},
        {'path': 'disease/v1/model', 'type': EntityType.Disease.value},
        {'path': 'gene/v1/model/1/', 'type': EntityType.Gene.value}
    ]
    LOADED_MODELS = []
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

    def __init__(self):
        print("AI Service init")
        self.load_models()

    def load_models(self):
        print("AI models loading")
        for model in self.ALL_MODELS:
            model_path = model['path']
            model_type = model['type']
            tfmodel = tf.saved_model.load(self.MODEL_DIRECTORY + model_path)
            self.LOADED_MODELS.append((model_type, tfmodel))
        print("AI models loaded")

    def infer(self, text: str):
        # Tokenize abstract
        tokenizer = nltk.WordPunctTokenizer()
        tokens = tf.ragged.constant([tokenizer.tokenize(text)])
        tokens_spans = list(tokenizer.span_tokenize(text))
        lens = tokens.row_lengths(axis=1)
        tokens = tokens.to_tensor(default_value='PAD')

        result = []
        for model_type, tfmodel in self.LOADED_MODELS:
            infer = tfmodel.signatures["serving_default"]

            # Tag abstract
            tag_text = infer(tokens=tokens, token_lens=lens)
            ends = tag_text['ends'][0].numpy()
            starts = tag_text['starts'][0].numpy()
            num_spans = tag_text['num_spans'][0].numpy()

            for i in range(num_spans):
                for j in range(starts[i], ends[i]):
                    token = tokens.numpy()[0][j].decode("utf-8")
                start = tokens_spans[starts[i]][0]
                end = tokens_spans[ends[i]-1][1]
                found = text[start:end]
                item = {
                    'low_index': start,
                    'high_index': end,
                    'item': found,
                    'type': model_type
                }
                result.append(item)
        return result

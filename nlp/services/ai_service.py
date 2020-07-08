import tensorflow as tf
import string
import nltk
import numpy as np
import argparse
import os
import time


class AIService():
    
    MODEL_DIRECTORY = '/models/'
    ALL_MODELS = [
        {'path': 'bacteria/v1/model/1/', 'type': 'bacteria'},
        {'path': 'chemical/v1/model', 'type': 'chemical'},
        {'path': 'disease/v1/model', 'type': 'disease'},
        {'path': 'gene/v1/model/1/', 'type': 'gene'}
    ]
    LOADED_MODELS = []
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

    def __init__(self):
        print("AI Service init")
        self.load_models()

    def load_models(self):
        print("AI models loading")
        for model in self.ALL_MODELS:
            modelPath = model['path']
            modelType = model['type']
            tfmodel = tf.saved_model.load(self.MODEL_DIRECTORY + modelPath)
            self.LOADED_MODELS.append(tfmodel)
        print("AI models loaded")

    def infer(self, text: str):
        # Tokenize abstract

        tokenizer = nltk.WordPunctTokenizer()
        tokens = tf.ragged.constant([tokenizer.tokenize(text)])
        tokens_spans = list(tokenizer.span_tokenize(text))
        lens = tokens.row_lengths(axis=1)
        tokens = tokens.to_tensor(default_value='PAD')

        result = []
        for idx,model in enumerate(self.ALL_MODELS):

            modelPath = model['path']
            modelType = model['type']
            tfmodel = self.LOADED_MODELS[idx]
            infer = tfmodel.signatures["serving_default"]

            # Tag abstract
            tag_text = infer(tokens=tokens, token_lens=lens)
            ends = tag_text['ends'][0].numpy()
            starts = tag_text['starts'][0].numpy()
            num_spans = tag_text['num_spans'][0].numpy()

            for i in range(num_spans):
                predict = ""
                for j in range(starts[i], ends[i]):
                    token = tokens.numpy()[0][j].decode("utf-8")
                start = tokens_spans[starts[i]][0]
                end = tokens_spans[ends[i]-1][1]
                found = text[start:end]
                item = {
                    'low_index': start,
                    'high_index': end,
                    'item': found,
                    'type': modelType
                }
                result.append(item)
        return result

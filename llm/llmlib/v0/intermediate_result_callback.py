from langchain.callbacks import StdOutCallbackHandler
from llmlib.utils.callbacks.base import GraphRetrieverManagerMixin


class IntermediateResultCallback(StdOutCallbackHandler, GraphRetrieverManagerMixin):
    pass

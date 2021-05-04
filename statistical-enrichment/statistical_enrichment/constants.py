from enum import Enum

class LogEventType(Enum):
    ANNOTATION = 'annotations'
    AUTHENTICATION = 'authentication'
    CONTENT_SEARCH = 'content_search'
    ELASTIC = 'elastic'
    ENRICHMENT = 'enrichment_table'
    KNOWLEDGE_GRAPH = 'knowledge_graph'
    SENTRY_HANDLED = 'handled_exception'
    SENTRY_UNHANDLED = 'unhandled_exception'
    SYSTEM = 'system'
    VISUALIZER = 'visualizer'
    VISUALIZER_SEARCH = 'visualizer_search'


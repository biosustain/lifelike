from IPython import get_ipython
from .html import html_formatters


def register_formatters(type_: str, formatters: dict):
    ipython_formatters = get_ipython().display_formatter.formatters
    ipython_html_formatter = ipython_formatters[type_]
    for cls, formatter in formatters.items():
        ipython_html_formatter.for_type(cls, formatter)


register_formatters('text/html', html_formatters)

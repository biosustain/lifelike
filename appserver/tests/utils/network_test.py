import pytest

from neo4japp.utils.network import URLFixerHandler, DirectDownloadDetectorHandler


@pytest.mark.parametrize(
    'url_pair', [
        # Basic tests
        ('http://www.example.com//a-simple/url//test',
         'http://www.example.com//a-simple/url//test'),
        ('https://www.example.com//a-simple/url//test',
         'https://www.example.com//a-simple/url//test'),
        ('https://user:pass@example.com:4000//test/test',
         'https://user:pass@example.com:4000//test/test'),
        ('ftp://test', 'ftp://test'),
        ('mailto:test@example.com?body=hi', 'mailto:test%40example.com?body=hi'),
        ('http://test@www.example.com:1000', 'http://test@www.example.com:1000'),

        # The Python std lib function does URL canonicalization
        # It'd be preferable if it didn't, but it does
        ('https://@example.com/test.pdf?#', 'https://@example.com/test.pdf'),
        ('https://@example.com/test.pdf?a#', 'https://@example.com/test.pdf?a'),
        ('https://@example.com/test.pdf?a#b', 'https://@example.com/test.pdf?a#b'),
        ('https://@example.com/test.pdf?#b', 'https://@example.com/test.pdf#b'),

        # Domain punycode
        ('https://💩.com', 'https://xn--ls8h.com'),

        # Try weird stuff
        ('https://🤙@example.com', 'https://%F0%9F%A4%99@example.com'),
        ('https://🤙@example.com/lets test 🤙.pdf',
         'https://%F0%9F%A4%99@example.com/lets%20test%20%F0%9F%A4%99.pdf'),
        ('https://www.example.com/the(file)-here$.pdf',
         'https://www.example.com/the%28file%29-here%24.pdf'),
        ('https://example.com/test_parameters.pdf?emoji=🤙',
         'https://example.com/test_parameters.pdf?emoji=%F0%9F%A4%99'),
        ('https://example.com/test_parameters.pdf#emoji=🤙',
         'https://example.com/test_parameters.pdf#emoji%3D%F0%9F%A4%99'),
    ],
    ids=lambda x: x[0],
)
def test_url_fixer_handler(url_pair):
    assert URLFixerHandler.fix_url(url_pair[0]) == url_pair[1]
    # Testing to make should that double encoding should not encode further
    assert URLFixerHandler.fix_url(url_pair[1]) == url_pair[1]


@pytest.mark.parametrize(
    'url_pair', [
        ('https://www.example.com//a-simple/url//test',
         'https://www.example.com//a-simple/url//test'),
        # wiley.com
        ('https://onlinelibrary.wiley.com/doi/epdf/10.1111/pce.13681',
         'https://onlinelibrary.wiley.com/doi/pdfdirect/10.1111/pce.13681?download=true')
    ],
    ids=lambda x: f'{x[0]} -> {x[1]}' if x[0] != x[1] else x[0],
)
def test_direct_download_handler(url_pair):
    assert DirectDownloadDetectorHandler.rewrite_url(url_pair[0]) == url_pair[1]
    # Testing to make should that double rewriting should not rewrite further
    assert DirectDownloadDetectorHandler.rewrite_url(url_pair[1]) == url_pair[1]

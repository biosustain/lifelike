import re
import socket
from http.client import HTTPSConnection, HTTPConnection
from http.cookiejar import CookieJar
from io import StringIO, BytesIO
from typing import List, Tuple
from urllib.error import URLError
from urllib.parse import urlsplit, urlunsplit, quote
from urllib.request import (
    HTTPSHandler,
    HTTPHandler,
    OpenerDirector,
    UnknownHandler,
    HTTPRedirectHandler,
    HTTPDefaultErrorHandler,
    HTTPErrorProcessor,
    HTTPCookieProcessor,
    BaseHandler,
    Request,
)

from IPy import IP

from neo4japp.constants import MAX_FILE_SIZE
from neo4japp.exceptions import UnsupportedMediaTypeError


class ControlledConnectionMixin:
    """
    A mixin that overrides the connect() method with one that blacklists
    certain IP classes and port ranges.
    """

    blocked_ports = {
        # This is a non-exhaustive list and not meant to provide any real security
        21,  # FTP
        22,  # SSH
        25,
        465,
        587,  # Mail
    }

    def is_ip_allowed(self, ip):
        """Check if a host is permitted."""
        ip_object = IP(ip)
        return ip_object.iptype() == "PUBLIC"

    def is_port_allowed(self, port):
        """Check if a port is permitted."""
        return 80 <= port <= 20000 and port not in self.blocked_ports

    def resolve(self, host):
        """Resolve the hostname into an IP."""
        return socket.gethostbyname(host)

    def connect(self):
        """
        Connect to the host and port specified in __init__., but only after
        checking if the host and port combination is permitted.
        """

        ip = self.resolve(self.host)
        port = self.port

        if not self.is_ip_allowed(ip):
            raise socket.error("connection to non-allowed IP blocked")

        if not self.is_port_allowed(port):
            raise socket.error("connection to non-allowed port blocked")

        self.sock = self._create_connection(
            (ip, port), self.timeout, self.source_address
        )
        self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

        if self._tunnel_host:
            self._tunnel()


class ControlledHTTPConnection(ControlledConnectionMixin, HTTPConnection):
    """A version of HTTPConnection that blacklists certain hosts and ports."""


class ControlledHTTPSConnection(ControlledConnectionMixin, HTTPSConnection):
    """A version of HTTPSConnection that blacklists certain hosts and ports."""

    def connect(self):
        "Connect to a host on a given (SSL) port."
        super().connect()

        if self._tunnel_host:
            server_hostname = self._tunnel_host
        else:
            server_hostname = self.host

        self.sock = self._context.wrap_socket(
            self.sock, server_hostname=server_hostname
        )


class DirectDownloadDetectorHandler(BaseHandler):
    """Try to detect direct download URLs on known websites."""

    rewrite_map: List[Tuple[re.Pattern, str]] = [
        # LL-3036 - Force wiley.com links to go to the direct PDF
        (
            re.compile('^https?://onlinelibrary.wiley.com/doi/epdf/([^?]+)$', re.I),
            'https://onlinelibrary.wiley.com/doi/pdfdirect/\\1?download=true',
        ),
    ]

    @classmethod
    def rewrite_url(cls, url):
        for rewrite_pair in cls.rewrite_map:
            url = rewrite_pair[0].sub(rewrite_pair[1], url)
        return url

    def http_request(self, request: Request):
        request.full_url = DirectDownloadDetectorHandler.rewrite_url(request.full_url)
        return request

    https_request = http_request


class URLFixerHandler(BaseHandler):
    """Make URLs valid."""

    @staticmethod
    def fix_url(url):
        parsed = urlsplit(url)

        scheme, netloc, path, query, fragment = parsed
        username = parsed.username
        password = parsed.password
        hostname = parsed.hostname
        port = parsed.port

        path = quote(path, '/%')
        query = quote(query, '&%=')
        fragment = quote(fragment, '%')

        # Encode the netloc
        new_netloc = StringIO()
        if username is not None:
            new_netloc.write(quote(username, '%'))
            if password is not None:
                new_netloc.write(':')
                new_netloc.write(quote(password, '%'))
            new_netloc.write('@')
        if hostname is not None:
            # Apply punycode
            new_netloc.write(hostname.encode('idna').decode('ascii'))
        if port is not None:
            new_netloc.write(':')
            new_netloc.write(str(port))
        netloc = new_netloc.getvalue()

        return urlunsplit((scheme, netloc, path, query, fragment))

    def http_request(self, request: Request):
        request.full_url = URLFixerHandler.fix_url(request.full_url)
        return request

    https_request = http_request


class ControlledHTTPHandler(HTTPHandler):
    """A version of HTTPHandler that blacklists certain hosts and ports."""

    def http_open(self, req):
        return self.do_open(ControlledHTTPConnection, req)


class ControlledHTTPSHandler(HTTPSHandler):
    """A version of HTTPSHandler that blacklists certain hosts and ports."""

    def https_open(self, req):
        return self.do_open(
            ControlledHTTPSConnection,
            req,
            context=self._context,
            check_hostname=self._check_hostname,
        )


class ContentTooLongError(URLError):
    """Raised when the content is too big."""


def check_acceptable_response(accept_header, content_type_header):
    if content_type_header is not None:
        # Reminder that mime-types have this structure: type/subtype;parameter=value
        # https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
        # See this list of common types for examples:
        # https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
        acceptable_types = map(
            lambda type: type.split(';')[0].strip(), accept_header.split(',')
        )
        content_type = content_type_header.split(';')[0].strip()

        def mime_char_repl(matchobj):
            return f'\\{matchobj.group(0)}' if matchobj.group(0) in ['.', '+'] else '.*'

        for type in acceptable_types:
            # Substitute regex special characters:
            # . -> \.
            # + -> \+
            # * -> .*
            if re.fullmatch(re.sub('[\\.\\+\\*]', mime_char_repl, type), content_type):
                return content_type
    raise UnsupportedMediaTypeError(
        f'Response Content-Type does not match the requested type: '
        + f'{content_type_header} vs. {accept_header}'
    )


def check_acceptable_size(length, max_length=MAX_FILE_SIZE):
    if length > max_length:
        raise ContentTooLongError(
            "file downloaded exceeded max ({} > {})".format(length, max_length)
        )


def read_url(
    url,
    max_length=MAX_FILE_SIZE,
    headers=None,
    read_chunk_size=8192,
    buffer=None,
    debug_level=0,
    prefer_direct_downloads=False,
    **kwargs,
):
    """
    Get the contents at a URL, while controlling access to some degree.

    :param url: string representation of the request url
    :param max_length: the maximum length to download
    :param headers: object representation of the request headers
    :param read_chunk_size: the size of each chunk when downloading
    :param buffer: the buffer object to put the data in -- if None, then a new
        memory BytesIO will be created
    :param debug_level: set to 1 to show requests in STDOUT
    :param prefer_direct_downloads: set to true to change URLs to direct download versions if known
    :param kwargs: arguments for the opener
    :return: the buffer
    """
    # Build the opener with only select handlers
    opener = OpenerDirector()
    cookie_jar = CookieJar()
    opener.add_handler(UnknownHandler())
    if prefer_direct_downloads:
        opener.add_handler(DirectDownloadDetectorHandler())
    opener.add_handler(HTTPDefaultErrorHandler())
    opener.add_handler(HTTPRedirectHandler())
    opener.add_handler(
        HTTPCookieProcessor(cookiejar=cookie_jar)
    )  # LL-1045 - add cookie support
    opener.add_handler(HTTPErrorProcessor())
    opener.add_handler(URLFixerHandler())  # LL-2990 - fix 'invalid' URLs
    opener.add_handler(ControlledHTTPHandler(debuglevel=debug_level))
    opener.add_handler(ControlledHTTPSHandler(debuglevel=debug_level))

    if headers is None:
        headers = {}

    req = Request(url, headers=headers)
    conn = opener.open(req, **kwargs)

    # First, check the content type returned by the server
    accept_header = req.headers.get('Accept', None)

    # If there is no accept header, no need to check the response type matches
    if accept_header is not None:
        content_type_header = conn.headers.get('Content-Type', None)
        check_acceptable_response(accept_header, content_type_header)

    # Then, check the content length returned by the server, if any
    server_length = conn.headers.get('Content-Length')
    if server_length is not None:
        try:
            check_acceptable_size(int(server_length), max_length)
        except ValueError:
            pass

    if not buffer:
        buffer = BytesIO()

    # Then download the data, chunk by chunk, but check the length ourselves
    length_downloaded = 0
    while True:
        # If the chunk size is really large, don't read more than necessary
        chunk = conn.read(min(read_chunk_size, max_length - length_downloaded + 1))
        chunk_len = len(chunk)

        if not chunk_len:
            break

        # Check length
        length_downloaded += chunk_len
        check_acceptable_size(length_downloaded, max_length)

        buffer.write(chunk)

    return buffer


__all__ = [
    'ControlledConnectionMixin',
    'ControlledHTTPConnection',
    'ControlledHTTPSConnection',
    'DirectDownloadDetectorHandler',
    'URLFixerHandler',
    'ControlledHTTPHandler',
    'ControlledHTTPSHandler',
    'ContentTooLongError',
    'check_acceptable_size',
    'check_acceptable_response',
    'read_url',
]

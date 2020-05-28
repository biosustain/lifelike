import socket
import urllib
from http.client import HTTPSConnection, HTTPConnection
from io import BytesIO
from urllib.request import HTTPSHandler, HTTPHandler, OpenerDirector,\
    UnknownHandler, HTTPRedirectHandler, \
    HTTPDefaultErrorHandler, HTTPErrorProcessor

from IPy import IP


class ControlledConnectionMixin:
    """
    A mixin that overrides the connect() method with one that blacklists
    certain IP classes and port ranges.
    """
    blocked_ports = {
        # This is a non-exhaustive list and not meant to provide any real security
        21,  # FTP
        22,  # SSH
        25, 465, 587,  # Mail
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

        self.sock = self._create_connection((ip, port), self.timeout, self.source_address)
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

        self.sock = self._context.wrap_socket(self.sock,
                                              server_hostname=server_hostname)


class ControlledHTTPHandler(HTTPHandler):
    """A version of HTTPHandler that blacklists certain hosts and ports."""

    def http_open(self, req):
        return self.do_open(ControlledHTTPConnection, req)


class ControlledHTTPSHandler(HTTPSHandler):
    """A version of HTTPSHandler that blacklists certain hosts and ports."""

    def https_open(self, req):
        return self.do_open(ControlledHTTPSConnection, req,
                            context=self._context, check_hostname=self._check_hostname)


class ContentTooLongError(urllib.error.URLError):
    """Raised when the content is too big."""


def read_url(*args, max_length, read_chunk_size=8192, buffer=None, **kwargs):
    """
    Get the contents at a URL, while controlling access to some degree.

    :param args: arguments for the opener
    :param max_length: the maximum length to download
    :param read_chunk_size: the size of each chunk when downloading
    :param buffer: the buffer object to put the data in -- if None, then a new
        memory BytesIO will be created
    :param kwargs: arguments for the opener
    :return: the buffer
    """
    # Build the opener with only select handlers
    opener = OpenerDirector()
    handler_classes = [UnknownHandler,
                       HTTPDefaultErrorHandler,
                       HTTPRedirectHandler,
                       HTTPErrorProcessor,
                       ControlledHTTPHandler,
                       ControlledHTTPSHandler]
    for cls in handler_classes:
        opener.add_handler(cls())

    conn = opener.open(*args, **kwargs)

    # First check the content length returned by the server, if any
    server_length = conn.headers.get('Content-Length')
    if server_length is not None:
        try:
            if int(server_length) > max_length:
                raise ContentTooLongError(
                    "file Content-Length too big ({} > {})".format(server_length, max_length))
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
        if length_downloaded > max_length:
            raise ContentTooLongError(
                "file downloaded exceeded max ({} > {})".format(length_downloaded, max_length))

        buffer.write(chunk)

    return buffer

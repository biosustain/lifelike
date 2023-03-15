import bioc
import graphviz
import io
import json
import os
import numpy as np
import re
import requests
import svg_stack
import tempfile
import textwrap
import typing
import zipfile

from base64 import b64encode
from bioc.biocjson import fromJSON as biocFromJSON, toJSON as biocToJSON
from dataclasses import dataclass
from flask import current_app, g
from graphviz import escape
from jsonlines import Reader as BioCJsonIterReader, Writer as BioCJsonIterWriter
from lxml import etree
from marshmallow import ValidationError
from math import ceil, floor
from pdfminer import high_level
from pdfminer.pdfdocument import PDFEncryptionError, PDFTextExtractionNotAllowed
from PIL import Image, ImageColor
from PyPDF4 import PdfFileWriter, PdfFileReader
from PyPDF4.generic import DictionaryObject
from typing import Optional, List

from neo4japp.constants import (
    ANNOTATION_STYLES_DICT,
    ARROW_STYLE_DICT,
    BORDER_STYLES_DICT,
    DEFAULT_BORDER_COLOR,
    DEFAULT_FONT_SIZE,
    DEFAULT_NODE_WIDTH,
    DEFAULT_NODE_HEIGHT,
    MAX_LINE_WIDTH,
    BASE_ICON_DISTANCE,
    IMAGE_HEIGHT_INCREMENT,
    FONT_SIZE_MULTIPLIER,
    SCALING_FACTOR,
    FILE_MIME_TYPE_DIRECTORY,
    FILE_MIME_TYPE_PDF,
    FILE_MIME_TYPE_BIOC,
    FILE_MIME_TYPE_MAP,
    FILE_MIME_TYPE_GRAPH,
    FILE_MIME_TYPE_ENRICHMENT_TABLE,
    ICON_SIZE,
    LIFELIKE_DOMAIN,
    BYTE_ENCODING,
    LABEL_OFFSET,
    PDF_MARGIN,
    NAME_NODE_OFFSET,
    TRANSPARENT_PIXEL,
    FILENAME_LABEL_MARGIN,
    FILENAME_LABEL_FONT_SIZE,
    IMAGES_RE,
    ASSETS_PATH,
    ICON_NODES,
    RELATION_NODES,
    DETAIL_TEXT_LIMIT,
    DEFAULT_IMAGE_NODE_WIDTH,
    DEFAULT_IMAGE_NODE_HEIGHT,
    LogEventType,
    IMAGE_BORDER_SCALE,
    WATERMARK_DISTANCE,
    WATERMARK_WIDTH,
    WATERMARK_ICON_SIZE,
    COLOR_TO_REPLACE,
    DEFAULT_FONT_RATIO,
    NODE_LINE_HEIGHT,
    MAX_NODE_HEIGHT,
    NODE_INSET
)
from neo4japp.exceptions import FileUploadError, HandledException, ContentValidationError
from neo4japp.models import Files
from neo4japp.schemas.formats.drawing_tool import validate_map
from neo4japp.schemas.formats.enrichment_tables import validate_enrichment_table
from neo4japp.schemas.formats.graph import validate_graph_format, validate_graph_content
from neo4japp.services.file_types.exports import FileExport, ExportFormatError
from neo4japp.services.file_types.service import BaseFileTypeProvider, Certanity
from neo4japp.utils import FileContentBuffer
from neo4japp.util import warn
from neo4japp.utils.logger import EventLog
# This file implements handlers for every file type that we have in Lifelike so file-related
# code can use these handlers to figure out how to handle different file types
from neo4japp.utils.string import extract_text
from neo4japp.warnings import ServerWarning, ContentValidationWarning

extension_mime_types = {
    '.pdf': 'application/pdf',
    '.llmap': 'vnd.***ARANGO_DB_NAME***.document/map',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    # TODO: Use a mime type library?
}


def is_valid_doi(doi):
    try:
        # not [bad request, not found] but yes to 403 - no access
        return requests.get(doi,
                            headers={
                                # sometimes request is filtered if there is no user-agent header
                                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) "
                                              "AppleWebKit/537.36 "
                                              "(KHTML, like Gecko) Chrome/51.0.2704.103 "
                                              "Safari/537.36"
                            }
                            ).status_code not in [400, 404]
    except Exception as e:
        current_app.logger.error(
            f'An unexpected error occurred while requesting DOI: {doi}',
            exc_info=e,
        )
        return False


# ref: https://stackoverflow.com/a/10324802
# Has a good breakdown of the DOI specifications,
# in case need to play around with the regex in the future
doi_re = re.compile(
    # match label pointing that it is DOI
    rb'(doi[\W]*)?'
    # match url to doi.org
    # doi might contain subdomain or 'www' etc.
    rb'((?:https?:\/\/)(?:[-A-z0-9]*\.)*doi\.org\/)?'
    # match folder (10) and register name
    rb'(10\.[0-9]{3,}(?:[\.][0-9]+)*\/)'
    # try match commonly used DOI format
    rb'([-A-z0-9]*)'
    # match up to first space (values after # are ~ignored anyway)
    rb'([^ \n\f#]*)'
    # match up to 20 characters in the same line (values after # are ~ignored anyway)
    rb'([^\n\f#]{0,20})',
    flags=re.IGNORECASE
)
protocol_re = re.compile(r'https?:\/\/')
unusual_characters_re = re.compile(r'([^-A-z0-9]+)')
characters_groups_re = re.compile(r'([a-z]+|[A-Z]+|[0-9]+|-+|[^-A-z0-9]+)')
common_escape_patterns_re = re.compile(rb'\\')
dash_types_re = re.compile(bytes("[‐᠆﹣－⁃−¬]+", BYTE_ENCODING))
# Used to match the links in maps during the export
SANKEY_RE = re.compile(r'^ */projects/.+/sankey/.+$')
SEARCH_RE = re.compile(r'^ */search/content')
KGSEARCH_RE = re.compile(r'^ */search/graph')
DIRECTORY_RE = re.compile(r'^ */(projects/.+/)?folders')
MAIL_RE = re.compile(r'^ *mailto:.+$')
ENRICHMENT_TABLE_RE = re.compile(r'^ */projects/.+/enrichment-table/.+$')
DOCUMENT_RE = re.compile(r'^ */projects/.+/files/.+$')
BIOC_RE = re.compile(r'^ */projects/.+/bioc/.+$')
ANY_FILE_RE = re.compile(r'^ */files/.+$')
# As other links begin with "projects" as well, we are looking for those without additional slashes
# looking like /projects/Example or /projects/COVID-19
PROJECTS_RE = re.compile(r'(^ */projects/(?!.*/.+).*)|(^ */(projects/.+/)?folders/.*#project)')
ICON_DATA: dict = {}
PDF_PAD = 1.0


def _search_doi_in(content: bytes) -> Optional[str]:
    doi: Optional[str]
    try:
        for match in doi_re.finditer(content):
            label, url, folderRegistrant, likelyDOIName, tillSpace, DOISuffix = \
                [s.decode(BYTE_ENCODING, errors='ignore') if s else '' for s in match.groups()]
            certainly_doi = label + url
            url = 'https://doi.org/'
            # is whole match a DOI? (finished on \n, trimmed whitespaces)
            doi = ((url + folderRegistrant + likelyDOIName + tillSpace +
                    DOISuffix).strip())
            if is_valid_doi(doi):
                return doi
            # is match till space a DOI?
            doi = (url + folderRegistrant + likelyDOIName + tillSpace)
            if is_valid_doi(doi):
                return doi
            # make deep search only if there was clear indicator that it is a doi
            if certainly_doi:
                # if contains escape patterns try substitute them
                if common_escape_patterns_re.search(match.group()):
                    doi = _search_doi_in(
                        common_escape_patterns_re.sub(
                            b'', match.group()
                        )
                    )
                    if is_valid_doi(doi):
                        return doi
                # try substitute different dash types
                if dash_types_re.search(match.group()):
                    doi = _search_doi_in(
                        dash_types_re.sub(
                            b'-', match.group()
                        )
                    )
                    if is_valid_doi(doi):
                        return doi
                # we iteratively start cutting off suffix on each group of
                # unusual characters
                try:
                    reversedDOIEnding = (tillSpace + DOISuffix)[::-1]
                    while reversedDOIEnding:
                        _, _, reversedDOIEnding = characters_groups_re.split(
                            reversedDOIEnding, 1)
                        doi = (
                                url + folderRegistrant + likelyDOIName + reversedDOIEnding[::-1]
                        )
                        if is_valid_doi(doi):
                            return doi
                except Exception:
                    pass
                # we iteratively start cutting off suffix on each group of either
                # lowercase letters
                # uppercase letters
                # numbers
                try:
                    reversedDOIEnding = (likelyDOIName + tillSpace)[::-1]
                    while reversedDOIEnding:
                        _, _, reversedDOIEnding = characters_groups_re.split(
                            reversedDOIEnding, 1)
                        doi = (
                                url + folderRegistrant + reversedDOIEnding[::-1]
                        )
                        if is_valid_doi(doi):
                            return doi
                except Exception:
                    pass
                # yield 0 matches on test case
                # # is it a DOI in common format?
                # doi = (url + folderRegistrant + likelyDOIName)
                # if is_valid_doi(doi):
                #     print('match by common format xxx')
                #     return doi
                # in very rare cases there is \n in text containing doi
                try:
                    end_of_match_idx = match.end(0)
                    first_char_after_match = content[end_of_match_idx:end_of_match_idx + 1]
                    if first_char_after_match == b'\n':
                        doi = _search_doi_in(
                            # new input = match + 50 chars after new line
                            match.group() +
                            content[end_of_match_idx + 1:end_of_match_idx + 1 + 50]
                        )
                        if is_valid_doi(doi):
                            return doi
                except Exception as e:
                    pass
    except Exception as e:
        pass
    return None


class DirectoryTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_DIRECTORY
    SHORTHAND = 'directory'
    mime_types = (MIME_TYPE,)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: FileContentBuffer):
        # Figure out file size
        size = buffer.size

        if size > 0:
            raise ValueError("Directories can't have content")


@dataclass
class TextExtractionNotAllowedWarning(ServerWarning):
    title: str = \
        "Author of this PDF disallowed content extraction"
    message: Optional[str] = \
        "Content of this file will not be automatically annotated within ***ARANGO_DB_NAME***"


class PDFTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_PDF
    SHORTHAND = 'pdf'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(
            self,
            buffer: FileContentBuffer,
            extension=None
            ) -> List[typing.Tuple[Certanity, str]]:
        with buffer as bufferView:
            return [(Certanity.match, self.MIME_TYPE)] if bufferView.read(5) == b'%PDF-' else []

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: FileContentBuffer):
        with buffer as bufferView:
            # Check that the pdf is considered openable
            try:
                high_level.extract_text(bufferView, page_numbers=[0], caching=False)
            except PDFTextExtractionNotAllowed as e:
                # TODO once we migrate to python 3.11: add PDFTextExtractionNotAllowed as __cause__
                warn(TextExtractionNotAllowedWarning())
                raise HandledException(e)
            except PDFEncryptionError:
                raise FileUploadError(
                    title='Failed to Read PDF',
                    message='This pdf is locked and cannot be loaded into Lifelike.')
            except Exception:
                raise FileUploadError(
                    title='Failed to Read PDF',
                    message='An error occurred while reading this pdf. '
                            'Please check if the pdf is unlocked and openable.'
                )

    def extract_doi(self, buffer: FileContentBuffer) -> Optional[str]:
        with buffer as bufferView:
            # Attempt 1: search through the first N bytes (most probably containing only metadata)
            chunk = bufferView.read(2 ** 17)
            doi = _search_doi_in(chunk)
            if doi is not None:
                return doi

            bufferView.seek(0)
            # Attempt 2: search through the first two pages of text (no metadata)
            try:
                text = high_level.extract_text(bufferView, page_numbers=[0, 1], caching=False)
            except PDFTextExtractionNotAllowed as e:
                # TODO once we migrate to python 3.11: add PDFTextExtractionNotAllowed as __cause__
                warn(TextExtractionNotAllowedWarning())
                raise HandledException(e)
            except Exception:
                raise FileUploadError(
                    title='Failed to Read PDF',
                    message='An error occurred while reading this pdf.'
                            ' Please check if the pdf is unlocked and openable.'
                )
            else:
                return _search_doi_in(bytes(text, encoding='utf8'))

    # ref: https://stackoverflow.com/a/10324802
    # Has a good breakdown of the DOI specifications,
    # in case need to play around with the regex in the future
    doi_re = re.compile(
        # match label pointing that it is DOI
        rb'(doi[\W]*)?'
        # match url to doi.org
        # doi might contain subdomain or 'www' etc.
        rb'((?:https?:\/\/)(?:[-A-z0-9]*\.)*doi\.org\/)?'
        # match folder (10) and register name
        rb'(10\.[0-9]{3,}(?:[\.][0-9]+)*\/)'
        # try match commonly used DOI format
        rb'([-A-z0-9]*)'
        # match up to first space (values after # are ~ignored anyway)
        rb'([^ \n\f#]*)'
        # match up to 20 characters in the same line (values after # are ~ignored anyway)
        rb'([^\n\f#]{0,20})',
        flags=re.IGNORECASE
    )
    protocol_re = re.compile(r'https?:\/\/')
    unusual_characters_re = re.compile(r'([^-A-z0-9]+)')
    characters_groups_re = re.compile(r'([a-z]+|[A-Z]+|[0-9]+|-+|[^-A-z0-9]+)')
    common_escape_patterns_re = re.compile(rb'\\')
    dash_types_re = re.compile(bytes("[‐᠆﹣－⁃−¬]+", BYTE_ENCODING))

    def to_indexable_content(self, buffer: FileContentBuffer):
        return buffer  # Elasticsearch can index PDF files directly

    def should_highlight_content_text_matches(self) -> bool:
        return True


class BiocTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_BIOC
    SHORTHAND = 'BioC'
    mime_types = (MIME_TYPE,)
    ALLOWED_TYPES = ['.xml', '.bioc']

    def detect_mime_type(
            self,
            buffer: FileContentBuffer,
            extension=None
            ) -> List[typing.Tuple[Certanity, str]]:
        with buffer as bufferView:
            try:
                # If it is xml file and bioc
                self.check_xml_and_bioc(bufferView)
                return [(Certanity.match, self.MIME_TYPE)]
            except BaseException:
                return []

    def handles(self, file: Files) -> bool:
        ext = os.path.splitext(file.filename)[1].lower()
        return super().handles(file) and ext in self.ALLOWED_TYPES

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: FileContentBuffer):
        with BioCJsonIterReader(buffer) as reader:
            for obj in reader:
                passage = biocFromJSON(obj, level=bioc.DOCUMENT)

    def extract_doi(self, buffer: FileContentBuffer) -> Optional[str]:
        with buffer as bufferView:
            data = bufferView.read()

            chunk = data[:2 ** 17]
            doi = _search_doi_in(chunk)
            return doi

    def convert(self, buffer):
        # assume it is xml
        with buffer as bufferView:
            collection = bioc.load(bufferView)
            # empty buffer
            bufferView.truncate(0)
            with BioCJsonIterWriter(bufferView) as writer:
                for doc in collection.documents:
                    writer.write(biocToJSON(doc))

    def check_xml_and_bioc(self, buffer: FileContentBuffer):
        tree = etree.parse(buffer)
        system_url: str = tree.docinfo.system_url
        result = system_url.lower().find('bioc')
        if result < 0:
            raise ValueError()


def substitute_svg_images(map_content: FileContentBuffer, images: list, zip_file: zipfile.ZipFile,
                          folder_name: str):
    """ Match every link inside SVG file and replace it with raw PNG data of icons or images from
    zip file. This has to be done after the graphviz call, as base64 PNG data is often longer than
    graphviz max length limit (~16k chars)
    params:
    :param map_content: bytes of the exported map
    :param images: list containing names of the images to embed
    :param zip_file: zip containing images
    :param folder_name: uuid of a temporary folder containing the images
    :returns: a modified svg file containing embedded images
    """
    icon_data = get_icons_data()
    text_content = map_content.read().decode(BYTE_ENCODING)
    text_content = IMAGES_RE.sub(lambda match: icon_data[match.group(0)], text_content)
    for image in images:
        text_content = text_content.replace(
            folder_name + '/' + image, 'data:image/png;base64,' + b64encode(
                zip_file.read("".join(['images/', image]))).decode(BYTE_ENCODING))
    return FileContentBuffer(bytes(text_content, BYTE_ENCODING))


def get_fitting_lines(text, style, data):
    if not text:
        return []
    fontsize = style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE
    line_height = NODE_LINE_HEIGHT * fontsize
    node_effective_height = data.get('height', MAX_NODE_HEIGHT - 2 * NODE_INSET)
    max_lines = floor(node_effective_height / line_height)
    if 'width' in data:
        max_character_per_line = (data['width'] - 2 * NODE_INSET) / (fontsize * DEFAULT_FONT_RATIO)
    else:
        max_character_per_line = min(10 + len(text) // 4, MAX_LINE_WIDTH)
    line_wrapper = textwrap.TextWrapper(
        width=ceil(max_character_per_line),
        replace_whitespace=False
    )
    # TextWrapper wrap is to be called per paragraf
    # (https://docs.python.org/3/library/textwrap.html#textwrap.TextWrapper.replace_whitespace)
    lines = []
    for paragraph in text.splitlines():
        # Text wrapper of '' returns [] but we want [''] to not swallow empty lines
        lines.extend(line_wrapper.wrap(paragraph) if paragraph else [''])
        if len(lines) > max_lines:
            lines = lines[:max_lines]
    return lines


def get_icons_data():
    """
    Lazy loading of the byte icon data from the PNG files
    """
    if ICON_DATA:
        return ICON_DATA
    else:
        for key in ['map', 'link', 'email', 'sankey', 'document', 'enrichment_table', 'note',
                    'ms-word', 'ms-excel', 'ms-powerpoint', 'cytoscape', '***ARANGO_DB_NAME***']:
            with open(f'{ASSETS_PATH}{key}.png', 'rb') as file:
                ICON_DATA[f'{ASSETS_PATH}{key}.png'] = 'data:image/png;base64,' \
                                                       + b64encode(file.read()) \
                                                           .decode(BYTE_ENCODING)
        return ICON_DATA


def create_group_node(group: dict):
    """
    Creates the node for NodeGroup - background, border, label, etc.
    :params:
    :param group: dict storing information about the group.
    :return: ready to display param dict and dict for corresponding group label, if label is present
    """
    style = group.get('style', {})
    display_name = group['display_name'] or ""

    has_border = style.get('lineType') and style.get('lineType') != 'none'
    href = get_node_href(group)

    params = {
        'name': group['hash'],
        # Graphviz offer no text break utility - it has to be done outside of it
        'label': '',
        'href': href,
        # We have to inverse the y-axis, as Graphviz coordinate system origin is at the bottom
        'pos': (
            f"{group['data']['x'] / SCALING_FACTOR},"
            f"{-group['data']['y'] / SCALING_FACTOR}!"
        ),
        # This is always set for groups
        'width': f"{group['data']['width'] / SCALING_FACTOR}",
        'height': f"{group['data']['height'] / SCALING_FACTOR}",
        'shape': 'box',
        'style': 'filled,' + BORDER_STYLES_DICT.get(style.get('lineType'), ''),
        'color': style.get('strokeColor'),
        'fontname': 'sans-serif',
        'margin': "0.2,0.0",
        'fillcolor': style.get('bgColor') or 'white',
        # Setting penwidth to 0 removes the border
        'penwidth': f"{style.get('lineWidthScale', 1.0)}" if has_border else '0.0'
    }

    if not display_name:
        return params, None

    border_width = style.get('lineWidthScale', 1.0) if has_border else 0.0
    label_font_size = style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE
    label_lines = get_fitting_lines(display_name, style, params['data'])
    label_offset = -group['data']['height'] / 2.0 - LABEL_OFFSET - \
        (label_font_size / 2.0 * (1 + len(label_lines))) - border_width
    label_params = {
        'name': group['hash'] + '_label',
        'label': escape('\n'.join(label_lines)),
        'href': href,
        'pos': (
            f"{group['data']['x'] / SCALING_FACTOR},"
            f"{(-group['data']['y'] - label_offset) / SCALING_FACTOR}!"
        ),
        'fontsize': f"{label_font_size}",
        'penwidth': '0.0',
        'fontcolor': style.get('fillColor') or 'black',
    }
    return params, label_params


def create_default_node(node: dict):
    """
    Creates a param dict with all the parameters required to create a simple text node or
    saving a baseline for more complex node - like map/note/link nodes'
    NOTE: When working with styles dict, remember that user can unset property (by clicking
    'default') which caused the key to have value of 'None'. This does NOT trigger the default case
    of .get(..., x), so you need to use get() or x instead.
    :params:
    :param node: a dictionary containing the information about currently rendered node
    :return: baseline dict with Graphviz paramaters
    """
    style = node.get('style', {})
    data = node['data']
    label_lines = get_fitting_lines(node['display_name'], style, data)
    return {
        'name': node['hash'],
        # Graphviz offer no text break utility - it has to be done outside of it
        'label': escape('\n'.join(label_lines)),
        # We have to inverse the y axis, as Graphviz coordinate system origin is at the bottom
        'pos': (
            f"{data['x'] / SCALING_FACTOR},"
            f"{-data['y'] / SCALING_FACTOR}!"
        ),
        # Resize the node base on font size, as otherwise the margin would be smaller than
        # in the Lifelike map editor
        'width': f"{data.get('width', DEFAULT_NODE_WIDTH) / SCALING_FACTOR}",
        'height': f"{data.get('height', DEFAULT_NODE_HEIGHT) / SCALING_FACTOR}",
        'shape': 'box',
        'style': 'rounded,filled,' + BORDER_STYLES_DICT.get(style.get('lineType'), ''),
        'color': style.get('strokeColor') or DEFAULT_BORDER_COLOR,
        'fontcolor': style.get('fillColor') or ANNOTATION_STYLES_DICT.get(
            node['label'], {'color': 'black'}).get('color'),
        'fontname': 'sans-serif',
        'margin': "0.2,0.0",
        'fillcolor': style.get('bgColor') or 'white',
        'fontsize': f"{style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE}",
        # Setting penwidth to 0 removes the border
        'penwidth': f"{style.get('lineWidthScale', 1.0)}"
        if style.get('lineType') != 'none' else '0.0'
    }


def create_image_label(node: dict):
    """
    Creates a node acting as a label for the image
    :params:
    :param node: dict containing the node data
    :returns: label params
    """
    style = node.get('style', {})
    data = node['data']
    height = data.get('height', DEFAULT_IMAGE_NODE_HEIGHT)
    # width = data.get('width', DEFAULT_IMAGE_NODE_WIDTH)
    border_width = style.get('lineWidthScale', 1.0) if style.get('lineType') != 'none' else 0.0
    label_font_size = style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE
    label_lines = get_fitting_lines(node['display_name'], style, data)
    label_offset = -height / 2.0 - LABEL_OFFSET - \
        (label_font_size / 2.0 * (1 + len(label_lines))) - border_width
    return {
        'label': escape('\n'.join(label_lines)),
        'pos': (
            f"{data['x'] / SCALING_FACTOR},"
            f"{(-data['y'] + label_offset) / SCALING_FACTOR + FILENAME_LABEL_MARGIN}!"
        ),
        'fontsize': f"{label_font_size}",
        'penwidth': '0.0',
        'fontcolor': style.get('fillColor') or 'black',
        'fontname': 'sans-serif',
        'name': node['hash'] + '_label'
    }


def create_image_node(node: dict, params: dict):
    """
    Add parameters specific to the image label.
    :params:
    :param node: dict containing the node data
    :param params: dict containing baseline parameters
    :returns: modified params
    """
    style = node.get('style', {})
    # Remove the label generated in 'create_default_node' - we will add it as separate node
    params['label'] = ""
    height = node['data'].get('height', DEFAULT_IMAGE_NODE_HEIGHT)
    width = node['data'].get('width', DEFAULT_IMAGE_NODE_WIDTH)
    params['penwidth'] = f"{style.get('lineWidthScale', 1.0) * IMAGE_BORDER_SCALE}" \
        if style.get('lineType') != 'none' else '0.0'
    params['width'] = f"{width / SCALING_FACTOR}"
    params['height'] = f"{height / SCALING_FACTOR}"
    params['fixedsize'] = 'true'
    params['imagescale'] = 'both'
    params['shape'] = 'rect'
    params['style'] = 'bold,' + BORDER_STYLES_DICT.get(style.get('lineType'), '')
    params['color'] = style.get('strokeColor') or 'white'
    return params


def create_detail_node(node: dict, params: dict):
    """
    Add parameters specific to the nodes which has a 'show detail text instead of a label'
    property. Due to the copyright, we limit the text in detail nodes dragged from the pdfs to 250
    characters - see https://sbrgsoftware.atlassian.net/browse/LL-3387 for details on problems.
    Due to the fact, that new lines can be present in the detail text (and need to be replaced with
    slash + l (which cant be written here due to the pep8 check) to align the text to the left, we
    need to be careful while escaping the text
    :params:
    :param node: dict containing the node data
    :param params: dict containing baseline parameters that have to be altered
    :returns: modified params dict
    """
    style = node.get('style', {})
    detail_text = node['data'].get('detail', '')
    # Check if the node was dragged from the pdf - if so, it will have a source link
    if (
            detail_text
            and (any(DOCUMENT_RE.match(src.get('url')) for src in node['data'].get('sources', []))
                 and len(detail_text) > DETAIL_TEXT_LIMIT)
    ):
        detail_text = detail_text[:DETAIL_TEXT_LIMIT]
        detail_text = detail_text.rstrip('\\')
    detail_lines = get_fitting_lines(detail_text, style, node['data'])
    # '\l' is graphviz special new line, which placed at the end of the line will align it
    # to the left - we use that instead of \n (and add one at the end to align last line)
    params['label'] = '\l'.join(map(escape, detail_lines)).replace('\n', '\l') + '\l'  # noqa: W605
    if params['fillcolor'] == 'white':
        params['fillcolor'] = ANNOTATION_STYLES_DICT.get(node['label'],
                                                         {'bgcolor': 'black'}
                                                         ).get('bgcolor')

    doi_src = look_for_doi_link(node)
    if doi_src:
        node['link'] = doi_src

    if not style.get('strokeColor'):
        # No border by default
        params['penwidth'] = '0.0'

    params['margin'] = "0.2,0.2"
    return params


def look_for_doi_link(node: dict):
    """
    Get DOI from links if available, and tests whether it is valid.
    :params:
    :param node: node data which links are tested
    return: doi if present and valid, None if not
    """
    doi_src = next(
        (src for src in node['data'].get('sources', []) if src.get(
            'domain') == "DOI"), None)
    # NOTE: As is_valid_doi sends a request, this increases export time for each doi that we have
    # If this is too costly, we can remove this
    if doi_src and is_valid_doi(doi_src['url']):
        return doi_src['url']
    return None


def get_link_icon_type(node: dict):
    """
    Evaluate the icon that link node should have (document, sankey, ET, mail or link)
    If the link is valid, save it and use it later when setting the node href
    Otherwise return None.
    :params:
    :param node: dict containing the node data
    :returns: the correct label for the icon and a corresponding URL - if valid
    """
    data = node['data'].get('sources', []) + node['data'].get('hyperlinks', [])
    for link in data:
        # TODO: This is getting bigger and bigger - refactor this for some clarity
        if ENRICHMENT_TABLE_RE.match(link['url']):
            return 'enrichment_table', link['url']
        elif SANKEY_RE.match(link['url']):
            return 'sankey', link['url']
        elif SEARCH_RE.search(link['url']):
            return 'search', link['url']
        elif KGSEARCH_RE.search(link['url']):
            return 'kgsearch', link['url']
        elif PROJECTS_RE.match(link['url']):
            return 'project', link['url']
        elif DIRECTORY_RE.search(link['url']):
            return 'directory', link['url']
        elif DOCUMENT_RE.match(link['url']):
            doi_src = look_for_doi_link(node)
            if doi_src:
                return 'document', doi_src
            # If the links point to internal document, remove it from the node data so it would
            # not became exported as node url - as that might violate copyrights
            if link in node['data'].get('sources', []):
                node['data']['sources'].remove(link)
            else:
                node['data']['hyperlinks'].remove(link)
            return 'document', None
        elif BIOC_RE.match(link['url']):
            return 'bioc', link['url']
        elif MAIL_RE.match(link['url']):
            return 'email', link['url']
        elif ANY_FILE_RE.match(link['url']):
            domain = link.get('domain', "").strip()
            if domain:
                # Do not return url, as we are not creating links to files that we not create on LL
                if domain.endswith('.docx') or domain.endswith('.doc'):
                    return 'ms-word', None
                elif domain.endswith('.pptx') or domain.endswith('.ppt'):
                    return 'ms-powerpoint', None
                elif domain.endswith('.xlsx') or domain.endswith('.xls'):
                    return 'ms-excel', None
                elif domain.endswith('.cys'):
                    return 'cytoscape', None
    return 'link', None


def create_icon_node(node: dict, params: dict, folder: tempfile.TemporaryDirectory):
    """
    Alters the params dict with the values suitable for creation of the nodes with icons and
    creates additional parameters' dict storing the information about the icon node
    :params:
    :param node: dict containing the node data
    :param params: dict containing baseline parameters that have to be altered
    :param folder: path to a temporary folder in which the icon should be stored
    :returns: modified params dict describing icon label and a new dict describing the icon
              itself. Additionally, returns computed height of icon + label to set it
              to a proper value
    """
    style = node.get('style', {})
    label = escape(node['label'])
    # Remove border around icon label and background color
    params['penwidth'] = '0.0'
    params['fillcolor'] = 'white'
    # Calculate the distance between icon and the label center
    distance_from_the_label = BASE_ICON_DISTANCE + params['label'].count('\n') \
        * IMAGE_HEIGHT_INCREMENT + FONT_SIZE_MULTIPLIER * (style.get('fontSizeScale', 1.0) - 1.0)

    node_height = distance_from_the_label * 2 + float(ICON_SIZE)
    node_height *= SCALING_FACTOR
    # Move the label below to make space for the icon node
    params['pos'] = (
        f"{node['data']['x'] / SCALING_FACTOR},"
        f"{-node['data']['y'] / SCALING_FACTOR - distance_from_the_label}!"
    )

    params['style'] = 'filled'
    params['fillcolor'] = '#00000000'

    # Create a separate node which will hold the image
    icon_params = {
        'name': "icon_" + node['hash'],
        'pos': (
            f"{node['data']['x'] / SCALING_FACTOR},"
            f"{-node['data']['y'] / SCALING_FACTOR}!"
        ),
        'label': "",
    }
    default_icon_color = ANNOTATION_STYLES_DICT.get(node['label'],
                                                    {'defaultimagecolor': 'black'}
                                                    )['defaultimagecolor']
    custom_icons = ANNOTATION_STYLES_DICT.get('custom_icons', {})
    if label == 'link':
        label, link = get_link_icon_type(node)
        # Save the link for later usage
        node['link'] = link
        custom_icons = ANNOTATION_STYLES_DICT.get('custom_icons', {})
        # If label is microsoft icon, we set default text color to its color for consistent look
        if label in custom_icons.keys():
            default_icon_color = custom_icons.get(label, default_icon_color)

    icon_params['image'] = (
        f'{ASSETS_PATH}{label}.png'
    )

    fill_color = style.get("fillColor") or default_icon_color
    if label not in custom_icons.keys():
        image_filename = os.path.sep.join([folder.name, f'{label}_{fill_color}.png'])
        icon_params['image'] = image_filename
        # If a file with such color x label combination was not created, create it
        if not os.path.exists(image_filename):
            # NOTE: If this turns out to be too time-consuming, switch to PNGs should be considered,
            # as those require much less modification.
            original_image: Image = Image.open(f'{ASSETS_PATH}{label}.png', 'r')
            orig_color = COLOR_TO_REPLACE
            replacement_color = ImageColor.getcolor(fill_color, 'RGBA')
            data = np.array(original_image.convert("RGBA"))
            data[(data == orig_color).all(axis=-1)] = replacement_color
            colored_image = Image.fromarray(data, mode='RGBA')
            colored_image.save(image_filename)

    icon_params['shape'] = 'box'
    icon_params['height'] = ICON_SIZE
    icon_params['width'] = ICON_SIZE
    icon_params['fixedsize'] = 'true'
    icon_params['imagescale'] = 'true'
    icon_params['penwidth'] = '0.0'
    params['fontcolor'] = style.get("fillColor") or default_icon_color
    return params, icon_params, node_height


def create_relation_node(node: dict, params: dict):
    """
    Adjusts the node into the relation node (purple ones)
    :params:
    :param node: dict containing the node data
    :param params: dict containing Graphviz parameters that will be altered
    :returns: altered params dict
    """
    style = node.get('style', {})
    default_color = ANNOTATION_STYLES_DICT.get(node['label'], {'color': 'black'})['color']
    params['color'] = style.get('strokeColor') or default_color
    params['fillcolor'] = style.get('bgColor') or default_color
    params['fontcolor'] = style.get('fillColor') or 'black'
    params['style'] += ',filled'
    return params


def get_node_href(node: dict):
    """
    Evaluates and sets the href for the node. If link parameter was not set previously, we are
    dealing with entity node (or icon node without any sources) - so we prioritize the
    hyperlinks here
    :params:
    :param node: dict containing the node data
    :returns: string with URL to which node should point - or empty string
    """
    href = ''
    if node.get('link'):
        href = node['link']
    elif node['data'].get('hyperlinks'):
        href = node['data']['hyperlinks'][0].get('url')
    elif node['data'].get('sources'):
        href = node['data']['sources'][0].get('url')

    # Whitespaces will break the link if we prepend the domain
    href = href.strip()
    # If url points to internal file, prepend it with the domain address
    if href.startswith('/'):
        # Remove Lifelike links to files that we do not create - due to the possible copyrights
        if ANY_FILE_RE.match(href):
            # Remove the link from the dictionary
            if node.get('link'):
                del node['link']
            elif node['data'].get('hyperlinks'):
                del node['data']['hyperlinks'][0]
            else:
                del node['data']['sources'][0]
            # And search again
            href = get_node_href(node)
        else:
            href = (LIFELIKE_DOMAIN or '') + href
    # For some reason, ' inside link breaks graphviz export. We need to encode it to %27 - LL-3924
    return href.replace("'", '%27')


def create_map_name_node():
    """
    Creates the baseline dict for map name node
    :retuns: dict describing the name node with Graphviz parameters
    """
    return {
        'fontcolor': ANNOTATION_STYLES_DICT.get('map', {'defaultimagecolor': 'black'}
                                                )['defaultimagecolor'],
        'fontsize': str(FILENAME_LABEL_FONT_SIZE),
        'shape': 'box',
        'style': 'rounded',
        'margin': f'{FILENAME_LABEL_MARGIN * 2},{FILENAME_LABEL_MARGIN}'
    }


def create_edge(edge: dict, node_hash_type_dict: dict):
    """
    Creates a dict with parameters required to render an edge
    :params:
    :param edge: dict containing the edge information
    :param node_hash_type_dict: lookup dict allowing to quickly check whether either head or
    tail is pointing to link or note (as this changes the default edge style)
    :returns: dict describing the edge with Graphviz parameters
    """
    style = edge.get('style', {})
    default_line_style = 'solid'
    default_arrow_head = 'arrow'
    edge_data = edge.get('data', {})
    url_data = edge_data.get('hyperlinks', []) + edge_data.get('sources', [])
    url = url_data[-1]['url'] if len(url_data) else ''
    if any(item in [node_hash_type_dict[edge['from']], node_hash_type_dict[edge['to']]] for
           item in ['link', 'note', 'image']):
        default_line_style = 'dashed'
        default_arrow_head = 'none'
    return {
        'tail_name': edge['from'],
        'head_name': edge['to'],
        # Pristine edges have 'label: null' - so we have to check them as escaping None type gives
        # error. Do not use .get() with default, as the key exist - it's the content that is missing
        'label': escape(edge['label']) if edge['label'] else "",
        'dir': 'both',
        'color': style.get('strokeColor') or DEFAULT_BORDER_COLOR,
        'arrowtail': ARROW_STYLE_DICT.get(style.get('sourceHeadType') or 'none'),
        'arrowhead': ARROW_STYLE_DICT.get(
            style.get('targetHeadType') or default_arrow_head),
        'penwidth': str(style.get('lineWidthScale', 1.0)) if style.get(
            'lineType') != 'none'
        else '0.0',
        'fontsize': str(style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE),
        'style': BORDER_STYLES_DICT.get(style.get('lineType') or default_line_style),
        # We need to encode ', or export will fail - LL-3924
        'URL': url.replace("'", "%27")
    }


def create_watermark():
    """
    Create a Lifelike watermark (icon, text, hyperlink) below the pdf.
    We need to ensure that the lowest node is not intersecting it - if so, we push it even lower.

    returns:
    3 dictionaries - each for one of the watermark elements
    """
    label_params = {
        'name': 'watermark_node',
        'label': 'Created by Lifelike',
        'pos': '0,0!',
        'width': f"{WATERMARK_WIDTH / SCALING_FACTOR}",
        'height': f"{DEFAULT_NODE_HEIGHT / SCALING_FACTOR}",
        'fontcolor': 'black',
        'fontname': 'sans-serif',
        'margin': "0.2,0.0",
        'fontsize': f"{DEFAULT_FONT_SIZE}",
        'penwidth': '0.0',

    }
    url_params = {
        'name': 'watermark_hyper',
        'label': '***ARANGO_DB_NAME***.bio',
        'href': 'https://***ARANGO_DB_NAME***.bio',
        'pos': (
            f"0,{-DEFAULT_NODE_HEIGHT / 2.0 / SCALING_FACTOR}!"
        ),
        'width': f"{WATERMARK_WIDTH / SCALING_FACTOR}",
        'height': f"{DEFAULT_NODE_HEIGHT / SCALING_FACTOR}",
        'fontcolor': 'blue',
        'fontname': 'sans-serif',
        'margin': "0.2,0.0",
        'fontsize': f"{DEFAULT_FONT_SIZE - 2}",
        'penwidth': '0.0'
    }
    icon_params = {
        'name': 'watermark_icon',
        'label': '',
        'pos': (
            f"{(-WATERMARK_WIDTH / 2.0 + WATERMARK_ICON_SIZE) / SCALING_FACTOR},0!"
        ),
        'penhwidth': '0.0',
        'fixedsize': 'true',
        'imagescale': 'both',
        'shape': 'rect',
        'image': ASSETS_PATH + '***ARANGO_DB_NAME***.png',
        'width': f"{WATERMARK_ICON_SIZE / SCALING_FACTOR}",
        'height': f"{WATERMARK_ICON_SIZE / SCALING_FACTOR}",
        'penwidth': '0.0'
    }
    return label_params, url_params, icon_params


class MapTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_MAP
    SHORTHAND = 'map'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(
            self,
            buffer: FileContentBuffer,
            extension=None
        ) -> List[typing.Tuple[Certanity, str]]:
        try:
            # If the data validates, I guess it's a map?
            self.validate_content(buffer)
            return [(Certanity.match, self.MIME_TYPE)]
        except ValueError:
            return []

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: FileContentBuffer):
        """
        Validates whether the uploaded file is a Lifelike map - a zip containing graph.json file
        describing the map and optionally, folder with the images. If there are any images specified
        in the json graph, their presence and accordance to the png standard is verified.
        :params:
        :param buffer: buffer containing the bytes of the file that has to be tested
        :raises ValueError: if the file is not a proper map file
        """
        with buffer as bufferView:
            try:
                with zipfile.ZipFile(bufferView) as zip_file:
                    # Test zip returns the name of the first invalid file inside the archive; if any
                    if zip_file.testzip():
                        raise ValueError
                    json_graph = json.loads(zip_file.read('graph.json'))
                    validate_map(json_graph)
                    for node in json_graph['nodes']:
                        if node.get('image_id'):
                            zip_file.read("".join(['images/', node.get('image_id'), '.png']))
            except (zipfile.BadZipFile, KeyError):
                raise ValueError

    def to_indexable_content(self, buffer: FileContentBuffer):
        with buffer as bufferView:
            # Do not catch exceptions here - there are handled in elastic_service.py
            zip_file = zipfile.ZipFile(bufferView)
            content_json = json.loads(zip_file.read('graph.json'))

            string_list = []

            nodes = content_json.get('nodes', [])
            for group in content_json.get('groups', []):
                nodes.append(group)
                nodes += group.get('members', [])

            for node in nodes:
                node_data = node.get('data', {})
                display_name = node.get('display_name', '')
                detail = node_data.get('detail', '') if node_data else ''
                string_list.append('' if display_name is None else display_name)
                string_list.append('' if detail is None else detail)

            for edge in content_json.get('edges', []):
                edge_data = edge.get('data', {})
                label = edge.get('label', '')
                detail = edge_data.get('detail', '') if edge_data else ''
                string_list.append('' if label is None else label)
                string_list.append('' if detail is None else detail)

            return FileContentBuffer(' '.join(string_list).encode(BYTE_ENCODING))

    def generate_export(self, file: Files, format: str, self_contained_export=False) -> FileExport:
        """
        Generates the map as a file in provided format. While working with this, remember that:
         - Most of the node parameters is optional (including width and height).
         - Graphviz y-axis is inverted (starts at the top)
         - SVG requires separate image embedding mechanism (get_icons_data)
        """
        if format not in ('png', 'svg', 'pdf'):
            raise ExportFormatError()

        # This should handle the naming and removal of the temporary directory
        folder = tempfile.TemporaryDirectory()

        try:
            zip_file = zipfile.ZipFile(FileContentBuffer(file.content.raw_file))
            json_graph = json.loads(zip_file.read('graph.json'))
        except KeyError:
            current_app.logger.info(
                f'Invalid map file: {file.hash_id} Cannot find map graph inside the zip!',
                extra=EventLog(
                    event_type=LogEventType.MAP_EXPORT_FAILURE.value).to_dict()
            )
            raise ValidationError('Cannot retrieve contents of the file - it might be corrupted')
        except zipfile.BadZipFile:
            current_app.logger.info(
                f'Invalid map file: {file.hash_id} File is a bad zipfile.',
                extra=EventLog(
                    event_type=LogEventType.MAP_EXPORT_FAILURE.value).to_dict()
            )
            raise ValidationError('Cannot retrieve contents of the file - it might be corrupted')

        graph = graphviz.Digraph(
            escape(file.filename),
            comment=file.description.encode('unicode_escape') if file.description else None,
            engine='fdp',
            format=format
        )

        graph.attr(
            margin=str(PDF_MARGIN),
            outputorder='nodesfirst',
            pad=str(PDF_PAD),
            overlap='false'
        )

        if format == 'png':
            graph.attr(dpi=100)

        node_hash_type_dict = {}
        images = []
        nodes = json_graph['nodes']

        with graph.subgraph(name='cluster_title') as title:
            title.attr(overlap='true', style='invis')
            if self_contained_export:
                # We add name of the map in left top corner to ease map recognition in linked export
                name_node_params = create_map_name_node()
                # Set outside of the function to avoid unnecessary copying of potentially big
                # variables
                name_node_params['name'] = file.filename

                title.node(**name_node_params)

        with graph.subgraph(name='cluster_body') as body:
            body.attr(overlap='true', style='invis')
            for group in json_graph.get('groups', []):
                nodes += group.get('members', [])
                group_params, label_params = create_group_node(group)
                body.node(**group_params)
                node_hash_type_dict[group['hash']] = group['label']

                if label_params:
                    body.node(**label_params)

            # Sort the images to the front of the list to ensure that they do not cover other nodes
            nodes.sort(key=lambda n: n.get('label', "") == 'image', reverse=True)

            for i, node in enumerate(nodes):
                # Store node hash->label for faster edge default type evaluation
                node_hash_type_dict[node['hash']] = node['label']
                style = node.get('style', {})
                params = create_default_node(node)

                if node['label'] == 'image':
                    try:
                        image_name = node.get('image_id') + '.png'
                        images.append(image_name)
                        im = Image.open(zip_file.open("".join(['images/', image_name])))
                        # Image prescaling is needed because Graphviz crashes on big images
                        # (it is either size >~1MB or resolution but no clear error is given)
                        # If an image is too big Graphviz will log cryptic warning that
                        # the image could not be found
                        im.resize((
                            int(node['data'].get('width', DEFAULT_IMAGE_NODE_WIDTH)),
                            int(node['data'].get('height', DEFAULT_IMAGE_NODE_HEIGHT))
                        ))
                        file_path = os.path.sep.join([folder.name, image_name])
                        im.save(file_path)
                    # Note: Add placeholder images instead?
                    except KeyError:
                        name = node.get('image_id') + '.png'
                        current_app.logger.info(
                            f'Invalid map file: {file.hash_id} Cannot retrieve image {name}.',
                            extra=EventLog(
                                event_type=LogEventType.MAP_EXPORT_FAILURE.value).to_dict()
                        )
                        raise ValidationError(
                            f"Cannot retrieve image: {name} - file might be corrupted")
                    params = create_image_node(node, params)
                    if node['display_name']:
                        body.node(**create_image_label(node))
                    params['image'] = file_path

                if node['label'] in ICON_NODES:
                    # map and note should point to the first source or hyperlink, if the are no
                    # sources
                    link_data = node['data'].get('sources', []) + node['data'].get('hyperlinks', [])
                    node['link'] = link_data[0].get('url') if link_data else None
                    if style.get('showDetail'):
                        params = create_detail_node(node, params)
                    else:
                        params, icon_params, node_height = create_icon_node(node, params, folder)
                        icon_params['href'] = get_node_href(node)
                        # We need to set this to ensure that watermark is not intersect some edge
                        # cases
                        nodes[i]['data']['height'] = node_height
                        # Create separate node with the icon
                        body.node(**icon_params)

                if node['label'] in RELATION_NODES:
                    params = create_relation_node(node, params)

                params['href'] = get_node_href(node)
                body.node(**params)

            for edge in json_graph['edges']:
                edge_params = create_edge(edge, node_hash_type_dict)
                body.edge(**edge_params)

        with graph.subgraph(name='cluster_footer') as footer:
            footer.attr(overlap='true', style='invis')
            for params in create_watermark():
                footer.node(**params)

        graph.edge(
            'cluster_title', 'cluster_body',
            len=str(NAME_NODE_OFFSET / SCALING_FACTOR),
            style='invis'
        )
        graph.edge(
            'cluster_body', 'cluster_footer',
            len=str(WATERMARK_DISTANCE / SCALING_FACTOR),
            style='invis'
        )

        ext = f".{format}"
        content = FileContentBuffer(graph.pipe())

        if format == 'svg':
            content = substitute_svg_images(content, images, zip_file, folder.name)

        if format == 'pdf' and not self_contained_export:
            reader = PdfFileReader(content, strict=False)
            writer = PdfFileWriter()
            writer.appendPagesFromReader(reader)
            self.add_file_bookmark(writer, 0, file)
            content = FileContentBuffer()
            writer.write(content)

        return FileExport(
            content=content,
            mime_type=extension_mime_types[ext],
            filename=f"{file.filename}{ext}"
        )

    def merge(self, files: List[Files], requested_format: str, links=None):
        """ Export, merge and prepare as FileExport the list of files
        :param files: List of Files objects. The first entry is always the main map,
        :param requested_format: export format
        :param links: List of dict objects storing info about links that should be embedded:
            x: x pos; y: y pos;
            page_origin: which page contains icon;
            page_destination: where should it take you
        :return: an exportable file.
        :raises: ValidationError if provided format is invalid
        """
        if requested_format == 'png':
            merger = self.merge_pngs_vertically
        elif requested_format == 'pdf':
            merger = self.merge_pdfs
        elif requested_format == 'svg':
            merger = self.merge_svgs
        else:
            raise ValidationError("Unknown or invalid export format for the requested file.",
                                  requested_format)
        ext = f'.{requested_format}'
        content = merger(files, links)
        return FileExport(
            content=content,
            mime_type=extension_mime_types[ext],
            filename=f"{files[0].filename}{ext}"
        )

    def get_file_export(self, file, format):
        """ Get the exported version of the file in requested format
            wrapper around abstract method to add map specific params and catch exception
         params
         :param file: map file to export
         :param format: wanted format
         :raises ValidationError: When provided format is invalid
         :return: Exported map as FileContentBuffer
         """
        try:
            return FileContentBuffer(
                self.generate_export(file, format, self_contained_export=True).content.getvalue()
            )
        except ExportFormatError:
            raise ValidationError("Unknown or invalid export "
                                  "format for the requested file.", format)

    def merge_pngs_vertically(self, files, _=None):
        """ Append pngs vertically.
        params:
        :param files: list of files to export
        :param _: links: omitted in case of png, added to match the merge_pdfs signature
        :returns: maps concatenated vertically
        :raises SystemError: when one of the images exceeds PILLOW decompression bomb size limits
        """
        final_bytes = FileContentBuffer()
        try:
            images = [Image.open(self.get_file_export(file, 'png')) for file in files]
        except Image.DecompressionBombError as e:
            raise SystemError('One of the files exceeds the maximum size - it cannot be exported'
                              'as part of the linked export')
        cropped_images = [image.crop(image.getbbox()) for image in images]
        widths, heights = zip(*(i.size for i in cropped_images))

        max_width = max(widths)
        total_height = sum(heights)

        new_im = Image.new('RGBA', (max_width, total_height), TRANSPARENT_PIXEL)
        y_offset = 0

        for im in cropped_images:
            x_offset = int((max_width - im.size[0]) / 2)
            new_im.paste(im, (x_offset, y_offset))
            y_offset += im.size[1]
        new_im.save(final_bytes, format='PNG')
        return final_bytes

    def add_file_bookmark(self, writer, page_number, file):
        file_bookmark = writer.addBookmark(file.path, page_number, bold=True)
        for line in (
            f'Description:\t{file.description}',
            f'Creation date:\t{file.creation_date}',
            f'Modified date:\t{file.modified_date}',
        ):
            writer.addBookmark(
                line, page_number, file_bookmark
            )

    def merge_pdfs(self, files: List[Files], link_to_page_map=None):
        """ Merge pdfs and add links to map.
        params:
        :param files: list of files to export.
        :param link_to_page_map: dict mapping url to pdf page number
        """
        link_to_page_map = link_to_page_map or dict()
        final_bytes = FileContentBuffer()
        writer = PdfFileWriter()
        links = []
        for origin_page, file in enumerate(files):
            out_file = self.get_file_export(file, 'pdf')
            reader = PdfFileReader(out_file, strict=False)
            # region Find internal links in pdf
            for page in map(reader.getPage, range(reader.getNumPages())):
                for annot in filter(
                    lambda o: isinstance(o, DictionaryObject) and o.get('/Subtype') == '/Link',
                    map(
                        lambda o: reader.getObject(o),
                        page.get('/Annots', [])
                    )
                ):
                    annotation = annot.get('/A')
                    if annotation:
                        uri = annotation.get('/URI')
                        rect = annot.get('/Rect')
                        destination_page = link_to_page_map.get(uri)
                        if destination_page is not None:
                            links.append(dict(
                                pagenum=origin_page,
                                pagedest=destination_page,
                                rect=rect
                            ))
            # endregion
            num_of_pages = writer.getNumPages()  # index of first attached page since this point
            writer.appendPagesFromReader(reader)
            self.add_file_bookmark(writer, num_of_pages, file)

        # Need to reiterate cause we cannot add links to not yet existing pages
        for link in links:
            writer.addLink(**link)
        writer.write(final_bytes)
        return final_bytes

    def merge_svgs(self, files: list, _=None):
        """ Merge svg files together with svg_stack
        params:
        :param files: list of files to be merged
        :param _: links: omitted in case of svg, added to match the merge_pdfs signature
        """
        doc = svg_stack.Document()
        layout2 = svg_stack.VBoxLayout()
        # String is used, since svg_stack cannot save to IOBytes - raises an error
        result_string = io.StringIO()
        for file in files:
            layout2.addSVG(self.get_file_export(file, 'svg'), alignment=svg_stack.AlignCenter)
        doc.setLayout(layout2)
        doc.save(result_string)
        return FileContentBuffer(result_string.getvalue().encode(BYTE_ENCODING))

    def update_map(self, params: dict, file_content: FileContentBuffer, updater=lambda x: x):
        with file_content as bufferView:
            try:
                zip_file = zipfile.ZipFile(bufferView)
            except zipfile.BadZipfile as e:
                raise ValidationError('Previous content of the map is corrupted!') from e

        images_to_delete = params.get('deleted_images') or []
        new_images = params.get('new_images') or []

        new_content = FileContentBuffer()
        new_zip = zipfile.ZipFile(new_content, 'w', zipfile.ZIP_DEFLATED, strict_timestamps=False)

        # Weirdly, zipfile will store both files rather than override on duplicate name, so we need
        # to make sure that the graph.json is not copied as well.
        images_to_delete.append('graph')
        files_to_copy = [hash_id for hash_id in zip_file.namelist() if
                         os.path.basename(hash_id).split('.')[0] not in images_to_delete]
        for filename in files_to_copy:
            new_zip.writestr(zipfile.ZipInfo(filename), zip_file.read(filename))

        for image in new_images:
            new_zip.writestr(zipfile.ZipInfo('images/' + image.filename + '.png'), image.read())
        if params.get('content_value') is not None:
            new_graph = params['content_value'].read()
        else:
            graph_json = json.loads(zip_file.read('graph.json'))
            new_graph_json = updater(graph_json)
            validate_map(new_graph_json)
            new_graph = json.dumps(new_graph_json, separators=(',', ':')).encode('utf-8')

        # IMPORTANT: Use zipfile.ZipInfo to avoid including timestamp info in the zip metadata! If
        # the timestamp is included, otherwise identical zips will have different checksums. This
        # is true for the two `writestr` calls above as well.
        new_zip.writestr(zipfile.ZipInfo('graph.json'), new_graph)
        new_zip.close()

        return new_content

    def prepare_content(
            self, buffer: FileContentBuffer, params: dict, file: Files
    ) -> FileContentBuffer:
        """
        Evaluate the changes in the images and create a new blob to store in the content.
        Since we cannot delete files from an archive, we need to copy everything (except for
        graph.json) into a new one.
        :params:
        :param buffer: buffer containing request data
        :param params: request parameters, containing info about images
        :param file: file which content is being modified
        """
        previous_content = file.content.raw_file

        return self.update_map(params, FileContentBuffer(previous_content))


class GraphTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_GRAPH
    SHORTHAND = 'Graph'
    mime_types = (MIME_TYPE,)
    EXTENSIONS = {'.graph'}

    def detect_mime_type(
            self,
            buffer: FileContentBuffer,
            extension=None
            ) -> List[typing.Tuple[Certanity, str]]:
        c = -1
        if extension in self.EXTENSIONS:
            c += 1
        try:
            self.validate_content(buffer)
            c += 1
        except (ValueError, ContentValidationError):
            pass
        if c >= 0:
            return [(Certanity(c), self.MIME_TYPE)]
        else:
            return []

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: FileContentBuffer):
        with buffer as bufferView:
            data = json.loads(bufferView.read())
            validate_graph_format(data)
        raise_content_errors = 'version' in data
        for content_error in validate_graph_content(data):
            if raise_content_errors:
                raise content_error
            else:
                g.warnings.append(
                    ContentValidationWarning(**content_error.to_dict())
                )

    def to_indexable_content(self, buffer: FileContentBuffer):
        with buffer as bufferView:
            content_json = json.load(bufferView)
            content = io.StringIO()
            string_list = set(extract_text(content_json))

            content.write(' '.join(list(string_list)))
            return FileContentBuffer(content.getvalue().encode(BYTE_ENCODING))


class EnrichmentTableTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_ENRICHMENT_TABLE
    SHORTHAND = 'enrichment-table'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(
            self,
            buffer: FileContentBuffer,
            extension=None
            ) -> List[typing.Tuple[Certanity, str]]:
        try:
            # If the data validates, I guess it's an enrichment table?
            # The enrichment table schema is very simple though so this is very simplistic
            # and will cause problems in the future
            self.validate_content(buffer)
            return [(Certanity.match, self.MIME_TYPE)]
        except ValueError:
            return []

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: FileContentBuffer):
        with buffer as bufferView:
            data = json.loads(bufferView.read())
            validate_enrichment_table(data)

    def to_indexable_content(self, buffer: FileContentBuffer):
        with buffer as bufferView:
            data = json.load(bufferView)
            content = io.StringIO()

            genes = data['data']['genes'].split(',')
            organism = data['data']['organism']
            content.write(', '.join(genes))
            content.write('\r\n\r\n')
            content.write(organism)
            content.write('\r\n\r\n')

            if 'result' in data:
                genes = data['result']['genes']
                for gene in genes:
                    content.write('\u2022 ')
                    content.write(gene['imported'])
                    if 'matched' in gene:
                        content.write(': ')
                        content.write(gene['matched'])
                    if 'fullName' in gene:
                        content.write(' (')
                        content.write(gene['fullName'])
                        content.write(')')
                    if 'domains' in gene:
                        for gene_domain in gene['domains'].values():
                            for value in gene_domain.values():
                                if len(value['text']):
                                    content.write('\n\u2192 ')
                                    content.write(value['text'])
                    content.write('.\r\n\r\n')

            return FileContentBuffer(content.getvalue().encode(BYTE_ENCODING))

    def should_highlight_content_text_matches(self) -> bool:
        return True

    def handle_content_update(self, file: Files):
        file.enrichment_annotations = None

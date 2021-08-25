import io
import json
import re
import typing
from base64 import b64encode

from io import BufferedIOBase
from typing import Optional, List

import textwrap
import graphviz
import requests
import svg_stack

from pdfminer import high_level
from bioc.biocjson import BioCJsonIterWriter, fromJSON as biocFromJSON, toJSON as biocToJSON
from jsonlines import Reader as BioCJsonIterReader, Writer as BioCJsonIterWriter
import os
import bioc
from marshmallow import ValidationError
from PyPDF4 import PdfFileWriter, PdfFileReader
from PIL import Image


from neo4japp.models import Files
from neo4japp.schemas.formats.drawing_tool import validate_map
from neo4japp.schemas.formats.enrichment_tables import validate_enrichment_table
from neo4japp.schemas.formats.graph import validate_graph
from neo4japp.services.file_types.exports import FileExport, ExportFormatError
from neo4japp.services.file_types.service import BaseFileTypeProvider
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
    DEFAULT_DPI,
    POINT_TO_PIXEL,
    HORIZONTAL_TEXT_PADDING,
    LABEL_OFFSET,
    MAP_ICON_OFFSET,
    PDF_MARGIN,
    NAME_NODE_OFFSET,
    TRANSPARENT_PIXEL,
    VERTICAL_NODE_PADDING,
    NAME_LABEL_FONT_AVERAGE_WIDTH,
    NAME_LABEL_PADDING_MULTIPLIER,
    FILENAME_LABEL_MARGIN,
    FILENAME_LABEL_FONT_SIZE,
    IMAGES_RE,
    ASSETS_PATH,
)

# This file implements handlers for every file type that we have in Lifelike so file-related
# code can use these handlers to figure out how to handle different file types
from neo4japp.utils.string import extract_text

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
)  # noqa
protocol_re = re.compile(r'https?:\/\/')
unusual_characters_re = re.compile(r'([^-A-z0-9]+)')
characters_groups_re = re.compile(r'([a-z]+|[A-Z]+|[0-9]+|-+|[^-A-z0-9]+)')
common_escape_patterns_re = re.compile(rb'\\')
dash_types_re = re.compile(bytes("[‐᠆﹣－⁃−¬]+", BYTE_ENCODING))
# Used to match the links in maps during the export
SANKEY_RE = re.compile(r'^ */projects/.+/sankey/.+$')
MAIL_RE = re.compile(r'^ *mailto:.+$')
ENRICHMENT_TABLE_RE = re.compile(r'^ */projects/.+/enrichment-table/.+$')
DOCUMENT_RE = re.compile(r'^ */projects/.+/files/.+$')
ANY_FILE_RE = re.compile(r'^ */files/.+$')
ICON_DATA: dict = {}


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
                # if self._is_valid_doi(doi):
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

    def validate_content(self, buffer: BufferedIOBase):
        # Figure out file size
        buffer.seek(0, io.SEEK_END)
        size = buffer.tell()

        if size > 0:
            raise ValueError("Directories can't have content")


class PDFTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_PDF
    SHORTHAND = 'pdf'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(self, buffer: BufferedIOBase) -> List[typing.Tuple[float, str]]:
        return [(0, self.MIME_TYPE)] if buffer.read(5) == b'%PDF-' else []

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        # TODO: Actually validate PDF content
        pass

    def extract_doi(self, buffer: BufferedIOBase) -> Optional[str]:
        data = buffer.read()
        buffer.seek(0)

        # Attempt 1: search through the first N bytes (most probably containing only metadata)
        chunk = data[:2 ** 17]
        doi = _search_doi_in(chunk)
        if doi is not None:
            return doi

        # Attempt 2: search through the first two pages of text (no metadata)
        fp = io.BytesIO(data)
        text = high_level.extract_text(fp, page_numbers=[0, 1], caching=False)
        doi = _search_doi_in(bytes(text, encoding='utf8'))

        return doi

    def _is_valid_doi(self, doi):
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
    )  # noqa
    protocol_re = re.compile(r'https?:\/\/')
    unusual_characters_re = re.compile(r'([^-A-z0-9]+)')
    characters_groups_re = re.compile(r'([a-z]+|[A-Z]+|[0-9]+|-+|[^-A-z0-9]+)')
    common_escape_patterns_re = re.compile(rb'\\')
    dash_types_re = re.compile(bytes("[‐᠆﹣－⁃−¬]+", BYTE_ENCODING))

    def to_indexable_content(self, buffer: BufferedIOBase):
        return buffer  # Elasticsearch can index PDF files directly

    def should_highlight_content_text_matches(self) -> bool:
        return True


class BiocTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_BIOC
    SHORTHAND = 'BioC'
    mime_types = (MIME_TYPE,)
    ALLOWED_TYPES = ['.xml', '.bioc']

    def handles(self, file: Files) -> bool:
        ext = os.path.splitext(file.filename)[1].lower()
        return super().handles(file) and ext in self.ALLOWED_TYPES

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        with BioCJsonIterReader(buffer) as reader:
            for obj in reader:
                passage = biocFromJSON(obj, level=bioc.DOCUMENT)

    def extract_doi(self, buffer: BufferedIOBase) -> Optional[str]:
        data = buffer.read()
        buffer.seek(0)

        chunk = data[:2 ** 17]
        doi = _search_doi_in(chunk)
        return doi

    def convert(self, buffer):
        # assume it is xml
        collection = bioc.load(buffer)
        buffer.stream = io.BytesIO()
        with BioCJsonIterWriter(buffer) as writer:
            for doc in collection.documents:
                writer.write(biocToJSON(doc))
        buffer.seek(0)


def substitute_svg_images(map_content: io.BytesIO):
    """ Match every link inside SVG file and replace it with raw PNG data
    params:
    :param map_content: bytes of the exported map
    """
    icon_data = get_icon_strings()
    output = IMAGES_RE.sub(lambda match: icon_data[match.group(0)], map_content.read()
                           .decode(BYTE_ENCODING))
    return io.BytesIO(bytes(output, BYTE_ENCODING))


def get_icon_strings():
    """ Lazy loading of the byte icon data from the PNG files
    """
    if ICON_DATA:
        return ICON_DATA
    else:
        for key in ['map', 'link', 'email', 'sankey', 'document', 'enrichment_table', 'note']:
            with open(f'{ASSETS_PATH}{key}.png', 'rb') as file:
                ICON_DATA[f'{ASSETS_PATH}{key}.png'] = 'data:image/png;base64,' \
                                                           + b64encode(file.read())\
                                                           .decode(BYTE_ENCODING)
        return ICON_DATA


class MapTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_MAP
    SHORTHAND = 'map'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(self, buffer: BufferedIOBase) -> List[typing.Tuple[float, str]]:
        try:
            # If the data validates, I guess it's a map?
            self.validate_content(buffer)
            return [(0, self.MIME_TYPE)]
        except ValueError:
            return []
        finally:
            buffer.seek(0)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        graph = json.loads(buffer.read())
        validate_map(graph)

    def to_indexable_content(self, buffer: BufferedIOBase):
        content_json = json.load(buffer)
        content = io.StringIO()
        string_list = []

        for node in content_json.get('nodes', []):
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

        content.write(' '.join(string_list))
        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode(BYTE_ENCODING)))

    def generate_export(self, file: Files, format: str, self_contained_export=False) -> FileExport:
        if format not in ('png', 'svg', 'pdf'):
            raise ExportFormatError()

        json_graph = json.loads(file.content.raw_file)
        graph_attr = [('margin', str(PDF_MARGIN)), ('outputorder', 'nodesfirst')]

        if format == 'png':
            graph_attr.append(('dpi', '100'))

        graph = graphviz.Digraph(
                file.filename,
                comment=file.description,
                engine='neato',
                graph_attr=graph_attr,
                format=format)

        node_hash_type_dict = {}
        x_values, y_values = [], []

        for node in json_graph['nodes']:
            if self_contained_export:
                # Store the coordinates of each node as map name node is based on them
                x_values.append(node['data']['x'])
                y_values.append(node['data']['y'])
            # Store node hash->label for faster edge default type evaluation
            node_hash_type_dict[node['hash']] = node['label']
            style = node.get('style', {})
            params = self.create_default_node(node)

            if node['label'] in ['map', 'link', 'note']:
                # map and note should point to the first source or hyperlink, if the are no sources
                link_data = node['data'].get('sources', []) + node['data'].get('hyperlinks', [])
                node['link'] = link_data[0].get('url') if link_data else None
                if style.get('showDetail'):
                    params = self.create_detail_node(node, params)
                else:
                    params, icon_params = self.create_icon_node(node, params)
                    graph.node(**icon_params)

            if node['label'] in ['association', 'correlation', 'cause', 'effect', 'observation']:
                default_color = ANNOTATION_STYLES_DICT.get(
                        node['label'],
                        {'color': 'black'})['color']
                params['color'] = style.get('strokeColor') or default_color
                if style.get('fillColor'):
                    params['color'] = style.get('strokeColor') or DEFAULT_BORDER_COLOR
                params['fillcolor'] = 'white' if style.get('fillColor') else default_color
                params['fontcolor'] = style.get('fillColor') or 'black'
                params['style'] += ',filled'

            if node.get('link'):
                params['href'] = node['link']
            elif node['data'].get('hyperlinks'):
                params['href'] = node['data']['hyperlinks'][0].get('url')
            elif node['data'].get('sources'):
                params['href'] = node['data']['sources'][0].get('url')
            current_link = params.get('href', "").strip()
            # If url points to internal file, append it with the domain address
            if current_link.startswith('/'):
                # Remove Lifelike links to files that we do not create
                if ANY_FILE_RE.match(current_link):
                    params['href'] = ''
                else:
                    params['href'] = LIFELIKE_DOMAIN + current_link
            graph.node(**params)

        if self_contained_export:
            name_node = {
                'name': file.filename,
                'fontcolor': ANNOTATION_STYLES_DICT.get('map', {'defaultimagecolor': 'black'}
                                                        )['defaultimagecolor'],
                'pos': (
                    f"{(min(x_values) - NAME_NODE_OFFSET) / SCALING_FACTOR},"
                    f"{-(min(y_values) - NAME_NODE_OFFSET) / SCALING_FACTOR}!"
                ) if x_values else '0,0!',
                'fontsize': str(FILENAME_LABEL_FONT_SIZE),
                'shape': 'box',
                'style': 'rounded',
                'margin': f'{FILENAME_LABEL_MARGIN * 2},{FILENAME_LABEL_MARGIN}'
            }
            graph.node(**name_node)

        for edge in json_graph['edges']:
            style = edge.get('style', {})
            default_line_style = 'solid'
            default_arrow_head = 'arrow'
            edge_data = edge.get('data', {})
            url_data = edge_data.get('hyperlinks', []) + edge_data.get('sources', [])
            url = url_data[-1]['url'] if len(url_data) else ''
            if any(item in [node_hash_type_dict[edge['from']], node_hash_type_dict[edge['to']]] for
                   item in ['link', 'note']):
                default_line_style = 'dashed'
                default_arrow_head = 'none'
            graph.edge(
                    edge['from'],
                    edge['to'],
                    edge['label'],
                    dir='both',
                    color=style.get('strokeColor') or DEFAULT_BORDER_COLOR,
                    arrowtail=ARROW_STYLE_DICT.get(style.get('sourceHeadType') or 'none'),
                    arrowhead=ARROW_STYLE_DICT.get(
                            style.get('targetHeadType') or default_arrow_head),
                    penwidth=str(style.get('lineWidthScale', 1.0)) if style.get(
                            'lineType') != 'none'
                    else '0.0',
                    fontsize=str(style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE),
                    style=BORDER_STYLES_DICT.get(style.get('lineType') or default_line_style),
                    URL=url

            )

        ext = f".{format}"

        content = io.BytesIO(graph.pipe())

        if format == 'svg':
            content = substitute_svg_images(content)

        return FileExport(
                content=content,
                mime_type=extension_mime_types[ext],
                filename=f"{file.filename}{ext}"
        )

    def create_default_node(self, node):
        """
        Creates a param dict with all the parameters required to create a simple text node or
        saving a baseline for more complex node - like map/note/link nodes
        :params:
        :param node: a dictionary containing the information about currently rendered node
        :return: baseline dict with Graphviz paramaters
        """
        style = node.get('style', {})
        return {
            'name': node['hash'],
            # Graphviz offer no text break utility - it has to be done outside of it
            'label': '\n'.join(textwrap.TextWrapper(
                width=min(10 + len(node['display_name']) // 4, MAX_LINE_WIDTH),
                replace_whitespace=False).wrap(node['display_name'])),
            # We have to inverse the y axis, as Graphviz coordinate system origin is at the bottom
            'pos': (
                f"{node['data']['x'] / SCALING_FACTOR},"
                f"{-node['data']['y'] / SCALING_FACTOR}!"
            ),
            # Resize the node base on font size, as otherwise the margin would be smaller than
            # in the Lifelike map editor
            'width': f"{node['data'].get('width', DEFAULT_NODE_WIDTH) / SCALING_FACTOR}",
            'height': f"{node['data'].get('height', DEFAULT_NODE_HEIGHT) / SCALING_FACTOR}",
            'shape': 'box',
            'style': 'rounded,' + BORDER_STYLES_DICT.get(style.get('lineType'), ''),
            'color': style.get('strokeColor') or DEFAULT_BORDER_COLOR,
            'fontcolor': style.get('fillColor') or ANNOTATION_STYLES_DICT.get(
                node['label'], {'color': 'black'}).get('color'),
            'fontname': 'sans-serif',
            'margin': "0.2,0.0",
            'fontsize': f"{style.get('fontSizeScale', 1.0) * DEFAULT_FONT_SIZE}",
            # Setting penwidth to 0 removes the border
            'penwidth': f"{style.get('lineWidthScale', 1.0)}"
            if style.get('lineType') != 'none' else '0.0'
        }

    def create_detail_node(self, node, params):
        """
        Add parameters specific to the nodes which has a 'show detail text instead of a label'
        property.
        :params:
        :param node: dict containing the node data
        :param params: dict containing baseline parameters that have to be altered
        :returns: modified params dict
        """
        params['style'] += ',filled'
        detail_text = node['data'].get('detail', ' ')
        params['label'] = '\n'.join(
            textwrap.TextWrapper(
                width=min(15 + len(detail_text) // 3, MAX_LINE_WIDTH),
                replace_whitespace=False).wrap(detail_text)) + '\n'
        # Align the text to the left with Graphviz custom escape sequence '\l'
        params['label'] = params['label'].replace('\n', r'\l')
        params['fillcolor'] = ANNOTATION_STYLES_DICT.get(node['label'],
                                                         {'bgcolor': 'black'}
                                                         ).get('bgcolor')
        if not node.get('style', {}).get('strokeColor'):
            # No border by default
            params['penwidth'] = '0.0'
        return params

    def create_icon_node(self, node, params):
        """
        Alters the params dict with the values suitable for creation of the nodes with icons and
        creates additional parameters dict storing the information about the icon node
        :params:
        :param node: dict containing the node data
        :param params: dict containing baseline parameters that have to be altered
        :returns: modified params dict descriping icon label and a new dict describing the icon
                  itself
        """
        style = node.get('style', {})
        label = node['label']
        # remove border around icon label
        params['penwidth'] = '0.0'
        # Calculate the distance between icon and the label center
        distance_from_the_label = BASE_ICON_DISTANCE + params['label'].count('\n') \
            * IMAGE_HEIGHT_INCREMENT + FONT_SIZE_MULTIPLIER * \
            (style.get('fontSizeScale', 1.0) - 1.0)
        # Create a separate node which will hold the image
        icon_params = {
            'name': "icon_" + node['hash'],
            'pos': (
                f"{node['data']['x'] / SCALING_FACTOR},"
                f"{-node['data']['y'] / SCALING_FACTOR + distance_from_the_label}!"
            ),
            'label': ""
        }
        default_icon_color = ANNOTATION_STYLES_DICT.get(node['label'],
                                                        {'defaultimagecolor': 'black'}
                                                        )['defaultimagecolor']
        if label == 'link':
            label, link = self.get_link_icon_type(node)

        icon_params['image'] = (
            f'{ASSETS_PATH}{label}.png'
        )
        icon_params['fillcolor'] = style.get("fillColor") or default_icon_color
        icon_params['style'] = 'filled'
        icon_params['shape'] = 'box'
        icon_params['height'] = ICON_SIZE
        icon_params['width'] = ICON_SIZE
        icon_params['fixedsize'] = 'true'
        icon_params['imagescale'] = 'true'
        icon_params['penwidth'] = '0.0'
        params['fontcolor'] = style.get("fillColor") or default_icon_color
        return params, icon_params

    def get_link_icon_type(self, node):
        """
        Evaluate the icon that link node should have (document, sankey, ET, mail or link)
        If the link is valid, save it and use it later when setting the node href
        Otherwise return None.
        :params:
        :param node: dict containing the node data
        :returns: the correct label for the icon and a corresponding URL - if valid
        """
        data = node['data'].get('sources', []) + node['data'].get('hyperlinks', [])
        label = 'link'
        url = None
        for link in data:
            if ENRICHMENT_TABLE_RE.match(link['url']):
                return 'enrichment_table', link['url']
            elif SANKEY_RE.match(link['url']):
                return 'sankey', link['url']
            elif DOCUMENT_RE.match(link['url']):
                doi_src = next(
                    (src for src in node['data'].get('sources') if src.get(
                        'domain') == "DOI"), None)
                # If there is a valid doi, link to DOI
                if doi_src and is_valid_doi(doi_src['url']):
                    return 'document', doi_src['url']
                # If the links point to internal document, remove it from the node data so it would
                # not became exported as node url - as that might violate copyrights
                if link in node['data'].get('sources', []):
                    node['data']['sources'].remove(link)
                else:
                    node['data']['hyperlinks'].remove(link)
                return 'document', None
            # We do not return on email, as email icon has lower precedence.
            elif MAIL_RE.match(link['url']):
                label = 'email'
                url = link['url']
        return label, url

    def merge(self, files: list, requested_format: str, links=None):
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
        if len(files) > 1:
            content = merger(files, links)
        else:
            content = self.get_file_export(files[0], requested_format)
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
         :return: Exported map as BytesIO
         """
        try:
            return io.BytesIO(self.generate_export(file, format, self_contained_export=True)
                              .content.getvalue())
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
        final_bytes = io.BytesIO()
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

    def merge_pdfs(self, files: list, links=None):
        """ Merge pdfs and add links to map.
        params:
        :param files: list of files to export.
        :param links: list of dicts describing internal map links
        """
        links = links or []
        final_bytes = io.BytesIO()
        writer = PdfFileWriter()
        half_size = int(ICON_SIZE) * DEFAULT_DPI / 2.0
        for i, out_file in enumerate(files):
            out_file = self.get_file_export(out_file, 'pdf')
            reader = PdfFileReader(out_file, strict=False)
            writer.appendPagesFromReader(reader)
        for link in links:
            file_index = link['page_origin']
            coord_offset, pixel_offset = get_content_offsets(files[file_index])
            x_base = ((link['x'] - coord_offset[0]) / SCALING_FACTOR * POINT_TO_PIXEL) + \
                PDF_MARGIN * DEFAULT_DPI + pixel_offset[0]
            y_base = ((-1 * link['y'] - coord_offset[1]) / SCALING_FACTOR * POINT_TO_PIXEL) + \
                PDF_MARGIN * DEFAULT_DPI - pixel_offset[1]
            writer.addLink(file_index, link['page_destination'],
                           [x_base - half_size, y_base - half_size - LABEL_OFFSET,
                            x_base + half_size, y_base + half_size])
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
        return io.BytesIO(result_string.getvalue().encode(BYTE_ENCODING))


class GraphTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_GRAPH
    SHORTHAND = 'Graph'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(self, buffer: BufferedIOBase) -> List[typing.Tuple[float, str]]:
        try:
            # If the data validates, I guess it's a map?
            if os.path.splitext(str(
                    # buffer in here is actually wrapper of BufferedIOBase and it contains
                    # filename even if type check fails
                    buffer.filename  # type: ignore[attr-defined]
            ))[1] == '.graph':
                return [(0, self.MIME_TYPE)]
            else:
                return []
        except (ValueError, AttributeError):
            return []
        finally:
            buffer.seek(0)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        data = json.loads(buffer.read())
        validate_graph(data)

    def to_indexable_content(self, buffer: BufferedIOBase):
        content_json = json.load(buffer)
        content = io.StringIO()
        string_list = set(extract_text(content_json))

        content.write(' '.join(list(string_list)))
        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode(BYTE_ENCODING)))

    def extract_metadata_from_content(self, file: Files, buffer: BufferedIOBase):
        if not file.description:
            data = json.loads(buffer.read())
            description = data['graph']['description']
            file.description = description


class EnrichmentTableTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = FILE_MIME_TYPE_ENRICHMENT_TABLE
    SHORTHAND = 'enrichment-table'
    mime_types = (MIME_TYPE,)

    def detect_mime_type(self, buffer: BufferedIOBase) -> List[typing.Tuple[float, str]]:
        try:
            # If the data validates, I guess it's an enrichment table?
            # The enrichment table schema is very simple though so this is very simplistic
            # and will cause problems in the future
            self.validate_content(buffer)
            return [(0, self.MIME_TYPE)]
        except ValueError:
            return []
        finally:
            buffer.seek(0)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        data = json.loads(buffer.read())
        validate_enrichment_table(data)

    def to_indexable_content(self, buffer: BufferedIOBase):
        data = json.load(buffer)
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

        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode(BYTE_ENCODING)))

    def should_highlight_content_text_matches(self) -> bool:
        return True

    def handle_content_update(self, file: Files):
        file.enrichment_annotations = None


def get_content_offsets(file):
    """ Gets offset box of the map, allowing to translate the coordinates to the pixels of the
        pdf generated by graphviz.
        *params*
        file: A Files object of map that is supposed to be analyzed
        Return: two pairs of coordinates: x & y.
        First denotes the offset to the pdf origin (in the units used by front-end renderer)
        Second denotes the offset created by the map name node (from which the margin is
        calculated) in pixels.
    """
    x_values, y_values = [], []
    json_graph = json.loads(file.content.raw_file)
    for node in json_graph['nodes']:
        x_values.append(node['data']['x'])
        y_values.append(-node['data']['y'])
    x_offset = max(len(file.filename), 0) * NAME_LABEL_FONT_AVERAGE_WIDTH / 2.0 - \
        MAP_ICON_OFFSET + HORIZONTAL_TEXT_PADDING * NAME_LABEL_PADDING_MULTIPLIER
    y_offset = VERTICAL_NODE_PADDING
    return (min(x_values), min(y_values)), (x_offset, y_offset)

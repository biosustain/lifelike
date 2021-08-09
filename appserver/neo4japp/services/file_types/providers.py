import io
import json
import re
import typing

from io import BufferedIOBase
from typing import Optional, List

import textwrap
import graphviz
import requests

from pdfminer import high_level
from bioc.biocjson import BioCJsonIterWriter, fromJSON as biocFromJSON, toJSON as biocToJSON
from jsonlines import Reader as BioCJsonIterReader, Writer as BioCJsonIterWriter
import os
import bioc

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
    LIFELIKE_DOMAIN
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
dash_types_re = re.compile(bytes("[‐᠆﹣－⁃−¬]+", 'utf-8'))
# Used to match the links in maps during the export
SANKEY_RE = re.compile(r'^ */projects/.+/sankey/.+$')
MAIL_RE = re.compile(r'^ *mailto:.+$')
ENRICHMENT_TABLE_RE = re.compile(r'^ */projects/.+/enrichment-table/.+$')
DOCUMENT_RE = re.compile(r'^ */projects/.+/files/.+$')
ANY_FILE_RE = re.compile(r'^ */files/.+$')


def _search_doi_in(content: bytes) -> Optional[str]:
    doi: Optional[str]
    try:
        for match in doi_re.finditer(content):
            label, url, folderRegistrant, likelyDOIName, tillSpace, DOISuffix = \
                [s.decode('utf-8', errors='ignore') if s else '' for s in match.groups()]
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
    dash_types_re = re.compile(bytes("[‐᠆﹣－⁃−¬]+", 'utf-8'))

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
        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode('utf-8')))

    def generate_export(self, file: Files, format: str) -> FileExport:
        if format not in ('png', 'svg', 'pdf'):
            raise ExportFormatError()

        json_graph = json.loads(file.content.raw_file)
        graph_attr = [('margin', '3'), ('outputorder', 'nodesfirst')]

        if format == 'png':
            graph_attr.append(('dpi', '300'))

        graph = graphviz.Digraph(
                file.filename,
                comment=file.description,
                engine='neato',
                graph_attr=graph_attr,
                format=format)

        node_hash_type_dict = {}

        for node in json_graph['nodes']:
            style = node.get('style', {})
            # Store node hash->label for faster edge default type evaluation
            node_hash_type_dict[node['hash']] = node['label']
            label = node['label']
            params = {
                'name': node['hash'],
                'label': '\n'.join(textwrap.TextWrapper(
                        width=min(10 + len(node['display_name']) // 4, MAX_LINE_WIDTH),
                        replace_whitespace=False).wrap(node['display_name'])),
                'pos': (
                    f"{node['data']['x'] / SCALING_FACTOR},"
                    f"{-node['data']['y'] / SCALING_FACTOR}!"
                ),
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
                'penwidth': f"{style.get('lineWidthScale', 1.0)}"
                if style.get('lineType') != 'none' else '0.0'
            }

            if node['label'] in ['map', 'link', 'note']:
                if style.get('showDetail'):
                    params['style'] += ',filled'
                    detail_text = node['data'].get('detail', ' ')
                    params['label'] = '\n'.join(
                            textwrap.TextWrapper(
                                    width=min(15 + len(detail_text) // 3, MAX_LINE_WIDTH),
                                    replace_whitespace=False).wrap(detail_text))
                    params['fillcolor'] = ANNOTATION_STYLES_DICT.get(node['label'],
                                                                     {'bgcolor': 'black'}
                                                                     ).get('bgcolor')
                    if not style.get('strokeColor'):
                        params['penwidth'] = '0.0'
                else:
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
                        data = node['data'].get('sources', []) + node['data'].get('hyperlinks', [])
                        for link in data:
                            if ENRICHMENT_TABLE_RE.match(link['url']):
                                label = 'enrichment_table'
                                node['link'] = link['url']
                                break
                            elif SANKEY_RE.match(link['url']):
                                label = 'sankey'
                                node['link'] = link['url']
                                break
                            elif DOCUMENT_RE.match(link['url']):
                                label = 'document'
                                doi_src = next(
                                    (src for src in node['data'].get('sources') if src.get(
                                        'domain') == "DOI"), None)
                                # If there is a valid doi, link to DOI
                                if doi_src and is_valid_doi(doi_src['url']):
                                    node['link'] = doi_src['url']
                                elif link in node['data'].get('sources', []):
                                    node['data']['sources'].remove(link)
                                else:
                                    node['data']['hyperlinks'].remove(link)
                                break
                            # We do not break on email, as email icon has lower precedence.
                            elif MAIL_RE.match(link['url']):
                                label = 'email'
                                node['link'] = link['url']

                    icon_params['image'] = (
                            f'/home/n4j/assets/{label}.png'
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
                params['href'] = node['data']['sources'][-1].get('url')
            elif node['data'].get('sources'):
                params['href'] = node['data']['sources'][-1].get('url')
            elif node['data'].get('hyperlinks'):
                params['href'] = node['data']['hyperlinks'][-1].get('url')
            current_link = params.get('href', "").strip()
            # If url points to internal file, append it with the domain address
            if current_link.startswith('/'):
                # Remove Lifelike links to files that we do not create
                if ANY_FILE_RE.match(current_link):
                    params['href'] = ''
                else:
                    params['href'] = LIFELIKE_DOMAIN + current_link
            graph.node(**params)

        for edge in json_graph['edges']:
            style = edge.get('style', {})
            default_line_style = 'solid'
            default_arrow_head = 'arrow'
            edge_data = edge.get('data', {})
            url_data = edge_data.get('hyperlinks', []) + edge_data.get('sources', [])
            url = next((src['url'] for src in url_data[::-1]), "")
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

        return FileExport(
                content=io.BytesIO(graph.pipe()),
                mime_type=extension_mime_types[ext],
                filename=f"{file.filename}{ext}"
        )


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
        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode('utf-8')))

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

        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode('utf-8')))

    def should_highlight_content_text_matches(self) -> bool:
        return True

    def handle_content_update(self, file: Files):
        file.enrichment_annotations = None

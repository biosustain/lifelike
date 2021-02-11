import io
import json
import re
from io import BufferedIOBase
from typing import Optional, List, Dict

import graphviz
import typing
from pdfminer import high_level

from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.models import Files
from neo4japp.schemas.formats.drawing_tool import validate_map
from neo4japp.schemas.formats.enrichment_tables import validate_enrichment_table
from neo4japp.services.file_types.exports import FileExport, ExportFormatError
from neo4japp.services.file_types.service import BaseFileTypeProvider

# This file implements handlers for every file type that we have in Lifelike so file-related
# code can use these handlers to figure out how to handle different file types

extension_mime_types = {
    '.pdf': 'application/pdf',
    '.llmap': 'vnd.lifelike.document/map',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    # TODO: Use a mime type library?
}


class DirectoryTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = 'vnd.lifelike.filesystem/directory'
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
    MIME_TYPE = 'application/pdf'
    mime_types = (MIME_TYPE,)

    def detect_content_confidence(self, buffer: BufferedIOBase) -> Optional[float]:
        # We don't even validate PDF content yet, but we need to detect them, so we'll
        # just return -1 so PDF becomes the fallback file type
        return -1

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
        doi = self._search_doi_in_pdf(chunk)
        if doi is not None:
            return doi

        # Attempt 2: search through the first two pages of text (no metadata)
        fp = io.BytesIO(data)
        text = high_level.extract_text(fp, page_numbers=[0, 1], caching=False)
        doi = self._search_doi_in_pdf(bytes(text, encoding='utf8'))

        return doi

    def _search_doi_in_pdf(self, content: bytes) -> Optional[str]:
        # ref: https://stackoverflow.com/a/10324802
        # Has a good breakdown of the DOI specifications,
        # in case need to play around with the regex in the future
        doi_re = rb'(?i)(?:doi:\s*|https?:\/\/doi\.org\/)(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)\b'  # noqa
        match = re.search(doi_re, content)

        if match is None:
            return None
        doi = match.group(1).decode('utf-8').replace('%2F', '/')
        # Make sure that the match does not contain undesired characters at the end.
        # E.g. when the match is at the end of a line, and there is a full stop.
        while doi and doi[-1] in './%':
            doi = doi[:-1]
        return doi if doi.startswith('http') else f'https://doi.org/{doi}'

    def to_indexable_content(self, buffer: BufferedIOBase):
        return buffer  # Elasticsearch can index PDF files directly

    def should_highlight_content_text_matches(self) -> bool:
        return True


class MapTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = 'vnd.lifelike.document/map'
    mime_types = (MIME_TYPE,)

    def detect_content_confidence(self, buffer: BufferedIOBase) -> Optional[float]:
        try:
            # If the data validates, I guess it's a map?
            self.validate_content(buffer)
            return 0
        except ValueError:
            return None
        finally:
            buffer.seek(0)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        graph = json.loads(buffer.read())
        validate_map(graph)

    def to_indexable_content(self, buffer: BufferedIOBase):
        content_json = json.load(buffer)

        map_data: Dict[str, List[Dict[str, str]]] = {
            'nodes': [],
            'edges': []
        }

        for node in content_json.get('nodes', []):
            map_data['nodes'].append({
                'label': node.get('label', ''),
                'display_name': node.get('display_name', ''),
                'detail': node.get('detail', ''),
            })

        for edge in content_json.get('edges', []):
            edge_data = edge.get('data', {})
            map_data['edges'].append({
                'label': edge.get('label', ''),
                'detail': edge_data.get('detail', '') if edge_data else '',
            })

        return typing.cast(BufferedIOBase, io.BytesIO(json.dumps(map_data).encode('utf-8')))

    def generate_export(self, file: Files, format: str) -> FileExport:
        if format not in ('png', 'svg', 'pdf'):
            raise ExportFormatError()

        json_graph = json.loads(file.content.raw_file)
        graph_attr = [('margin', '3')]

        if format == 'png':
            graph_attr.append(('dpi', '300'))

        graph = graphviz.Digraph(
            file.filename,
            comment=file.description,
            engine='neato',
            graph_attr=graph_attr,
            format=format)

        for node in json_graph['nodes']:
            params = {
                'name': node['hash'],
                'label': node['display_name'],
                'pos': f"{node['data']['x'] / 55},{-node['data']['y'] / 55}!",
                'shape': 'box',
                'style': 'rounded',
                'color': '#2B7CE9',
                'fontcolor': ANNOTATION_STYLES_DICT.get(node['label'], {'color': 'black'})['color'],
                'fontname': 'sans-serif',
                'margin': "0.2,0.0"
            }

            if node['label'] in ['map', 'link', 'note']:
                label = node['label']
                params['image'] = f'/home/n4j/assets/{label}.png'
                params['labelloc'] = 'b'
                params['forcelabels'] = "true"
                params['imagescale'] = "both"
                params['color'] = '#ffffff00'

            if node['label'] in ['association', 'correlation', 'cause', 'effect', 'observation']:
                params['color'] = ANNOTATION_STYLES_DICT.get(
                    node['label'],
                    {'color': 'black'})['color']
                params['fillcolor'] = ANNOTATION_STYLES_DICT.get(
                    node['label'],
                    {'color': 'black'})['color']
                params['fontcolor'] = 'black'
                params['style'] = 'rounded,filled'

            if 'hyperlink' in node['data'] and node['data']['hyperlink']:
                params['href'] = node['data']['hyperlink']
            if 'source' in node['data'] and node['data']['source']:
                params['href'] = node['data']['source']

            graph.node(**params)

        for edge in json_graph['edges']:
            graph.edge(
                edge['from'],
                edge['to'],
                edge['label'],
                color='#2B7CE9'
            )

        ext = f".{format}"

        return FileExport(
            content=io.BytesIO(graph.pipe()),
            mime_type=extension_mime_types[ext],
            filename=f"{file.filename}{ext}"
        )


class EnrichmentTableTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = 'vnd.lifelike.document/enrichment-table'
    mime_types = (MIME_TYPE,)

    def detect_content_confidence(self, buffer: BufferedIOBase) -> Optional[float]:
        try:
            # If the data validates, I guess it's an enrichment table?
            # The enrichment table schema is very simple though so this is very simplistic
            # and will cause problems in the future
            self.validate_content(buffer)
            return 0
        except ValueError:
            return None
        finally:
            buffer.seek(0)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        data = json.loads(buffer.read())
        validate_enrichment_table(data)

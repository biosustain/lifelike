import io
import json
import re
import typing
from io import BufferedIOBase
from typing import Optional, List, Dict

import graphviz
import requests
from pdfminer import high_level

from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.models import Files
from neo4japp.schemas.formats.drawing_tool import validate_map
from neo4japp.schemas.formats.enrichment_tables import validate_enrichment_table
from neo4japp.services.file_types.exports import FileExport, ExportFormatError
from neo4japp.services.file_types.service import BaseFileTypeProvider
import base64

# This file implements handlers for every file type that we have in Lifelike so file-related
# code can use these handlers to figure out how to handle different file types

extension_mime_types = {
    '.pdf': 'application/pdf',
    '.llmap': 'vnd.***ARANGO_DB_NAME***.document/map',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    # TODO: Use a mime type library?
}


class DirectoryTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = 'vnd.***ARANGO_DB_NAME***.filesystem/directory'
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

class NotPDFError(AssertionError):
    pass

class PDFTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = 'application/pdf'
    SHORTHAND = 'pdf'
    mime_types = (MIME_TYPE,)

    def convert_to_pdf(self, buffer):
        # if not pdf try to covert to pdf
        import shutil
        import os
        f = open("tmp", "wb")
        shutil.copyfileobj(buffer.stream, f)
        f.close()
        # adjust spreadsheets print areas (do not slice vertically)
        os.system("/bin/libreoffice* --headless --nologo --nofirststartwizard --norestore  tmp  macro:///Standard.Module1.FitToPage")
        # convert to pdf
        assert(~os.system("/bin/libreoffice* --convert-to pdf tmp"))
        f = open("tmp.pdf", "rb")
        buffer.stream = f
        # f.close()

    def detect_content_confidence(self, buffer: BufferedIOBase) -> Optional[float]:
        # We don't even validate PDF content yet, but we need to detect them, so we'll
        try:
            self.validate_content(buffer)
        except NotPDFError:
            return None

        # just return -1 so PDF becomes the fallback file type
        return -1

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        try:
            assert buffer.stream.readline(4) == b'%PDF'
        except AssertionError:
            raise NotPDFError
        finally:
            buffer.stream.seek(0)

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

    def _search_doi_in_pdf(self, content: bytes) -> Optional[str]:
        doi: Optional[str]
        try:
            for match in self.doi_re.finditer(content):
                label, url, folderRegistrant, likelyDOIName, tillSpace, DOISuffix = \
                    [s.decode('utf-8', errors='ignore') if s else '' for s in match.groups()]
                certainly_doi = label + url
                url = 'https://doi.org/'
                # is whole match a DOI? (finished on \n, trimmed whitespaces)
                doi = ((url + folderRegistrant + likelyDOIName + tillSpace +
                        DOISuffix).strip())
                if self._is_valid_doi(doi):
                    return doi
                # is match till space a DOI?
                doi = (url + folderRegistrant + likelyDOIName + tillSpace)
                if self._is_valid_doi(doi):
                    return doi
                # make deep search only if there was clear indicator that it is a doi
                if certainly_doi:
                    # if contains escape patterns try substitute them
                    if self.common_escape_patterns_re.search(match.group()):
                        doi = self._search_doi_in_pdf(
                                self.common_escape_patterns_re.sub(
                                        b'', match.group()
                                )
                        )
                        if self._is_valid_doi(doi):
                            return doi
                    # try substitute different dash types
                    if self.dash_types_re.search(match.group()):
                        doi = self._search_doi_in_pdf(
                                self.dash_types_re.sub(
                                        b'-', match.group()
                                )
                        )
                        if self._is_valid_doi(doi):
                            return doi
                    # we iteratively start cutting off suffix on each group of
                    # unusual characters
                    try:
                        reversedDOIEnding = (tillSpace + DOISuffix)[::-1]
                        while reversedDOIEnding:
                            _, _, reversedDOIEnding = self.characters_groups_re.split(
                                    reversedDOIEnding, 1)
                            doi = (
                                    url + folderRegistrant + likelyDOIName + reversedDOIEnding[::-1]
                            )
                            if self._is_valid_doi(doi):
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
                            _, _, reversedDOIEnding = self.characters_groups_re.split(
                                    reversedDOIEnding, 1)
                            doi = (
                                    url + folderRegistrant + reversedDOIEnding[::-1]
                            )
                            if self._is_valid_doi(doi):
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
                            doi = self._search_doi_in_pdf(
                                    # new input = match + 50 chars after new line
                                    match.group() +
                                    content[end_of_match_idx + 1:end_of_match_idx + 1 + 50]
                            )
                            if self._is_valid_doi(doi):
                                return doi
                    except Exception as e:
                        pass
        except Exception as e:
            pass
        return None


def to_indexable_content(self, buffer: BufferedIOBase):
    return buffer  # Elasticsearch can index PDF files directly


def should_highlight_content_text_matches(self) -> bool:
    return True

class HTMLTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = 'application/html'
    SHORTHAND = 'html'
    mime_types = (MIME_TYPE,)

    def convert_to_html(self, buffer):
        # if not pdf try to covert to pdf
        import shutil
        import os
        os.system("rm tmp*")
        with open("tmp", "wb") as f:
            shutil.copyfileobj(buffer.stream, f)
        # adjust spreadsheets print areas (do not slice vertically)
        # os.system("/bin/libreoffice* --headless --nologo --nofirststartwizard --norestore  tmp  macro:///Standard.Module1.FitToPage")
        # convert to pdf
        assert(~os.system("/bin/libreoffice* --convert-to html tmp"))
        data = None
        with open("tmp.html", "rb") as f:
            data = f.read()

        def embedImages(match):
            data_uri = base64.b64encode(open(match.group(2), 'rb').read()).replace(b'\n', b'')
            return match.group(1) + b'"data:image/png;base64,' + data_uri + b'"'

        data2 = re.sub(rb'(<img.*src=)"(.*?)"', embedImages, data)

        buffer.stream = io.BytesIO(data2)

    def detect_content_confidence(self, buffer: BufferedIOBase) -> Optional[float]:
        # We don't even validate PDF content yet, but we need to detect them, so we'll
        try:
            self.convert_to_html(buffer)
            return 0
        except Exception as e:
            pass

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        pass

    def extract_doi(self, buffer: BufferedIOBase) -> Optional[str]:
        data = buffer.read()
        buffer.seek(0)

        # Attempt 1: search through the first N bytes (most probably containing only metadata)
        chunk = data[:2 ** 17]
        doi = self._search_doi_in_pdf(chunk)

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
    MIME_TYPE = 'vnd.***ARANGO_DB_NAME***.document/map'
    SHORTHAND = 'map'
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
        content = io.StringIO()
        string_list = []

        for node in content_json.get('nodes', []):
            node_data = node.get('data', {})
            string_list.append(node.get('display_name', ''))
            string_list.append(node_data.get('detail', '') if node_data else '')

        for edge in content_json.get('edges', []):
            edge_data = edge.get('data', {})
            string_list.append(edge.get('label', ''))
            string_list.append(edge_data.get('detail', '') if edge_data else '')

        content.write(' '.join(string_list))
        return typing.cast(BufferedIOBase, io.BytesIO(content.getvalue().encode('utf-8')))

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
    MIME_TYPE = 'vnd.***ARANGO_DB_NAME***.document/enrichment-table'
    SHORTHAND = 'enrichment-table'
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

    def to_indexable_content(self, buffer: BufferedIOBase):
        data = json.load(buffer)
        content = io.StringIO()

        data_tokens = data['data'].split('/')
        genes = data_tokens[0].split(',')
        organism = data_tokens[2]
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

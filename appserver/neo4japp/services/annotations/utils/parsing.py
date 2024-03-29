import requests

from string import punctuation
from typing import Any, Dict, List, Tuple

from neo4japp.utils.globals import config
from ..constants import MAX_ABBREVIATION_WORD_LENGTH
from ..data_transfer_objects import PDFWord

from neo4japp.constants import FILE_MIME_TYPE_PDF
from neo4japp.exceptions import ServerException


def process_parsed_content(resp: dict) -> Tuple[str, List[PDFWord]]:
    parsed = []
    pdf_text = ''

    for page in resp['pages']:
        prev_words: List[str] = []
        pdf_text += page['pageText']
        for token in page['tokens']:
            # for now ignore any rotated words
            if token['text'] not in punctuation and all(
                [rect['rotation'] == 0 for rect in token['rects']]
            ):
                token_len = len(token['text'])
                offset = token['pgIdx']
                pdf_word = PDFWord(
                    keyword=token['text'],
                    normalized_keyword=token['text'],  # don't need to normalize yet
                    page_number=page['pageNo'],
                    lo_location_offset=offset,
                    hi_location_offset=offset
                    if token_len == 1
                    else offset + token_len - 1,
                    heights=[rect['height'] for rect in token['rects']],
                    widths=[rect['width'] for rect in token['rects']],
                    coordinates=[
                        [
                            rect['lowerLeftPt']['x'],
                            rect['lowerLeftPt']['y'],
                            rect['lowerLeftPt']['x'] + rect['width'],
                            rect['lowerLeftPt']['y'] + rect['height'],
                        ]
                        for rect in token['rects']
                    ],
                    previous_words=' '.join(prev_words[-MAX_ABBREVIATION_WORD_LENGTH:])
                    if token['possibleAbbrev']
                    else '',
                )
                parsed.append(pdf_word)
                prev_words.append(token['text'])
                if len(prev_words) > MAX_ABBREVIATION_WORD_LENGTH:
                    prev_words = prev_words[1:]
    return pdf_text, parsed


def parse_content(
    content_type=FILE_MIME_TYPE_PDF, **kwargs
) -> Tuple[str, List[PDFWord]]:
    if content_type == FILE_MIME_TYPE_PDF:
        url = config.get('PARSER_PDF_ENDPOINT')
    else:
        url = config.get('PARSER_TEXT_ENDPOINT')

    if 'exclude_references' in kwargs:
        try:
            file_id = kwargs['file_id']
            exclude_references = kwargs['exclude_references']
        except KeyError as e:
            raise ServerException(
                'Parsing Error',
                'Cannot parse the PDF file, the file id is missing or data is corrupted.',
            ) from e
        data = {
            'fileUrl': f'{config.get("PARSER_RESOURCE_PULL_ENDPOINT")}/{file_id}',
            'excludeReferences': exclude_references,
        }
    else:
        data = {'text': kwargs['text']}

    request_args: Dict[str, Any] = dict(
        url=url, data=data, timeout=config.get('REQUEST_TIMEOUT')
    )
    try:
        req = requests.post(**request_args)
        resp = req.json()
        req.close()
    except requests.exceptions.ConnectTimeout as e:
        raise ServerException(
            'Parsing Error',
            'The request timed out while trying to connect to the parsing service.',
            fields=request_args,
        ) from e
    except requests.exceptions.Timeout as e:
        raise ServerException(
            'Parsing Error',
            'The request to the parsing service timed out.',
            fields=request_args,
        ) from e
    except (requests.exceptions.RequestException, Exception) as e:
        raise ServerException(
            'Parsing Error',
            'An unexpected error occurred with the parsing service.',
            fields=request_args,
        ) from e

    return process_parsed_content(resp)

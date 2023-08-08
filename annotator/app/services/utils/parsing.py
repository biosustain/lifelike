import requests

from string import punctuation
from typing import List, Tuple

from app.exceptions import ServerException
from app.logs import get_logger
from app.services.constants import (
    MAX_ABBREVIATION_WORD_LENGTH,
    PARSER_RESOURCE_PULL_ENDPOINT,
    REQUEST_TIMEOUT,
)
from app.services.data_transfer_objects.dto import PDFWord

logger = get_logger()


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


def get_parser_args_for_file(file_id: int, exclude_references: bool):
    return {
        'fileUrl': f'{PARSER_RESOURCE_PULL_ENDPOINT}/{file_id}',
        'excludeReferences': exclude_references,
    }


def get_parser_args_for_text(text: str):
    return {'text': text}


def request_parse(url: str, data: dict):
    try:
        req = requests.post(url, data=data, timeout=REQUEST_TIMEOUT)
        resp = req.json()
        req.close()
    except requests.exceptions.ConnectTimeout:
        raise ServerException(
            'Parsing Error',
            'The request timed out while trying to connect to the parsing service.',
        )
    except requests.exceptions.Timeout:
        raise ServerException(
            'Parsing Error', 'The request to the parsing service timed out.'
        )
    except (requests.exceptions.RequestException, Exception):
        raise ServerException(
            'Parsing Error', 'An unexpected error occurred with the parsing service.'
        )
    return process_parsed_content(resp)

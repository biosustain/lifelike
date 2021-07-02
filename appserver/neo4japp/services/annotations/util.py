import requests

from string import punctuation
from typing import List, Tuple

from .constants import MAX_ABBREVIATION_WORD_LENGTH, REQUEST_TIMEOUT
from .data_transfer_objects import PDFWord


def has_center_point(coords: List[float], new_coords: List[float]) -> bool:
    """Checks if the center point of one set of coordinates
    are in another.
    """
    x1, y1, x2, y2 = coords
    new_x1, new_y1, new_x2, new_y2 = new_coords

    center_x = (new_x1 + new_x2)/2
    center_y = (new_y1 + new_y2)/2

    return x1 <= center_x <= x2 and y1 <= center_y <= y2


def process_parsed_content(resp: dict) -> Tuple[str, List[PDFWord]]:
    parsed = []
    pdf_text = ''

    for page in resp['pages']:
        prev_words: List[str] = []
        pdf_text += page['pageText']
        for token in page['tokens']:
            # for now ignore any rotated words
            if token['text'] not in punctuation and all([rect['rotation'] == 0 for rect in token['rects']]):  # noqa
                pdf_word = PDFWord(
                    keyword=token['text'],
                    normalized_keyword=token['text'],  # don't need to normalize yet
                    page_number=page['pageNo'],
                    lo_location_offset=token['pgIdx'],
                    hi_location_offset=token['pgIdx'] if len(
                        token['text']) == 1 else token['pgIdx'] + len(token['text']) - 1,  # noqa
                    heights=[rect['height'] for rect in token['rects']],
                    widths=[rect['width'] for rect in token['rects']],
                    coordinates=[
                        [
                            rect['lowerLeftPt']['x'],
                            rect['lowerLeftPt']['y'],
                            rect['lowerLeftPt']['x'] + rect['width'],
                            rect['lowerLeftPt']['y'] + rect['height']
                        ] for rect in token['rects']
                    ],
                    previous_words=' '.join(
                        prev_words[-MAX_ABBREVIATION_WORD_LENGTH:]) if token['possibleAbbrev'] else '',  # noqa
                )
                parsed.append(pdf_word)
                prev_words.append(token['text'])
                if len(prev_words) > MAX_ABBREVIATION_WORD_LENGTH:
                    prev_words = prev_words[1:]
    return pdf_text, parsed


def parse_content(data_type: str = 'pdf', **kwargs) -> Tuple[str, List[PDFWord]]:
    if data_type == 'text':
        url = 'http://pdfparser:7600/token/rect/text/json'
    else:
        url = 'http://pdfparser:7600/token/rect/json/'

    if 'exclude_references' in kwargs:
        file_id = kwargs['file_id']
        exclude_references = kwargs['exclude_references']
        data = {
            'fileUrl': f'http://appserver:5000/annotations/files/{file_id}',
            'excludeReferences': exclude_references
        }
    else:
        data = {'text': kwargs['text']}

    req = requests.post(url, data=data, timeout=REQUEST_TIMEOUT)
    resp = req.json()
    req.close()

    return process_parsed_content(resp)

from string import punctuation, whitespace
from typing import List

from unidecode import unidecode


def clean_char(c) -> str:
    # pdfminer does not correctly convert
    # convert all unicode characters to nearest ascii
    return unidecode(c)


def normalize_str(s) -> str:
    normalized = s.lower()
    normalized = normalized.translate(str.maketrans('', '', punctuation))
    return normalized.translate(str.maketrans('', '', whitespace))


def standardize_str(s) -> str:
    standardized = s.translate(str.maketrans('', '', punctuation))
    return " ".join(standardized.split())


def has_center_point(coords: List[float], new_coords: List[float]) -> bool:
    """Checks if the center point of one set of coordinates
    are in another.
    """
    x1, y1, x2, y2 = coords
    new_x1, new_y1, new_x2, new_y2 = new_coords

    center_x = (new_x1 + new_x2)/2
    center_y = (new_y1 + new_y2)/2

    return x1 <= center_x <= x2 and y1 <= center_y <= y2

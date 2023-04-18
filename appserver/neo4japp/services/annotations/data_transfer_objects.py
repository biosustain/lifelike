import attr

from typing import List

@attr.s(slots=True)
class PDFWord():
    keyword: str = attr.ib()
    normalized_keyword: str = attr.ib()
    page_number: int = attr.ib()
    lo_location_offset: int = attr.ib()
    hi_location_offset: int = attr.ib()
    # used to determine abbreviations
    # if word is wrapped in parenthesis
    # this attribute will not be empty string
    previous_words: str = attr.ib()
    heights: List[float] = attr.ib(default=attr.Factory(list))
    widths: List[float] = attr.ib(default=attr.Factory(list))
    coordinates: List[List[float]] = attr.ib(default=attr.Factory(list))
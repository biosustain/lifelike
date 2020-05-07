from string import punctuation, whitespace

from unidecode import unidecode


def normalize_str(s) -> str:
    # convert all unicode characters to nearest ascii
    normalized = unidecode(s).lower()
    normalized = normalized.translate(str.maketrans('', '', punctuation))
    return normalized.translate(str.maketrans('', '', whitespace))

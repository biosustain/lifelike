from string import punctuation, whitespace

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

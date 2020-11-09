from string import punctuation, whitespace

from unidecode import unidecode


def clean_char(c) -> str:
    # pdfminer does not correctly convert
    # convert all unicode characters to nearest ascii
    return unidecode(c)


def normalize_str(s) -> str:
    normalized = clean_char(s).lower()
    normalized = normalized.translate(str.maketrans('', '', punctuation))
    return normalized.translate(str.maketrans('', '', whitespace))


def standardize_str(s) -> str:
    standardized = clean_char(s)
    standardized = standardized.translate(str.maketrans('', '', punctuation))
    return " ".join(standardized.split())

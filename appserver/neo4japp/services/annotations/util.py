from string import punctuation, whitespace


def normalize_str(s) -> str:
    normalized = s.lower()
    normalized = normalized.translate(str.maketrans('', '', punctuation))
    return normalized.translate(str.maketrans('', '', whitespace))

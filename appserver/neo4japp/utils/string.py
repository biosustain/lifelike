import re
import sys

import unicodedata


def is_nice_word_boundary_char(ch):
    return not unicodedata.category(ch)[0] in ('C', 'Z')


def is_nice_char(ch):
    return not unicodedata.category(ch)[0] in ('C',)


def is_nice_filename_char(ch):
    category = unicodedata.category(ch)
    return not category[0] in ('C',) and (category[0] != 'Z' or category == 'Zs')


all_unicode_chars = ''.join(chr(c) for c in range(sys.maxunicode + 1))
unicode_whitespace = ''.join(re.findall(r'\s', all_unicode_chars))
stripped_characters = ''.join(ch for ch in all_unicode_chars if (
        unicodedata.category(ch)[0] in ('C', 'Z')
))

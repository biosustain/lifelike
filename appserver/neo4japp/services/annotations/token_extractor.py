import re

from typing import Set

from pdfminer import high_level


class TokenExtractor:
    def __init__(self) -> None:
        self.max_word_length = 4  # TODO: go into constants.py if used by other classes

    def parse_pdf(self, pdf) -> str:
        return high_level.extract_text(pdf)

    def extract_tokens(self, text: str) -> Set[str]:
        """Extract word tokens from the text argument.

        Returns a token set of sequentially concatentated
        words up to the max word length.

        E.g ['A', 'B', 'C', 'D', 'E'] -> ['A', 'A B', 'A B C', 'B', 'B C', ...]
        """
        # do negative lookahead and lookbehind
        # split on single spaces only while keeping
        # multiple spaces as one word
        #
        # e.g e. coli -> ['e.', 'coli']
        # e.g e.   coli -> ['e.   coli']
        word_list = re.split(r'(?<!\s) (?!\s)|\n', text)

        end_index = curr_max_words = 1
        tokens = set()
        max_length = len(word_list)

        for i, _ in enumerate(word_list):
            while curr_max_words <= self.max_word_length and end_index <= max_length:
                word = ' '.join(word_list[i:end_index]).strip()
                if word and word != ' ' and word not in tokens:
                    tokens.add(word)
                    curr_max_words += 1
                end_index += 1
            curr_max_words = 1
            end_index = i + 2

        return tokens

from langchain.output_parsers.list import ListOutputParser
from typing import List, Dict, Any


class GraphResultsOutputParser(ListOutputParser):
    """Parse the output of a graph query to a list."""

    key: str = 'output'
    separator: str = '\n'

    def get_format_instructions(self) -> str:
        return (
            "Your response should be a list of results, "
            "eg: `[{key:<result1>}, {key:<result2>}]`"
        )

    @property
    def _type(self) -> str:
        return "graph-result-list"

    def parse_result(self, result: List[Dict[str, Any]]) -> List[str]:
        """Parse the output of a graph query."""
        return self.parse(self.separator.join(map(lambda row: row[self.key], result)))

    def parse(self, text: str) -> str:
        return text

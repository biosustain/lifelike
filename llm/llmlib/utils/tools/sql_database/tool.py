# flake8: noqa
"""Tools for interacting with a Graph database."""
from typing import Optional

from langchain.pydantic_v1 import BaseModel, Extra, Field

from langchain.callbacks.manager import (
    CallbackManagerForToolRun,
)
from langchain.tools.base import BaseTool


class BaseGraphDatabaseTool(BaseModel):
    """Base tool for interacting with a Graph database."""

    db: GraphDatabase = Field(exclude=True)

    # Override BaseTool.Config to appease mypy
    # See https://github.com/pydantic/pydantic/issues/4173
    class Config(BaseTool.Config):
        """Configuration for this pydantic object."""

        arbitrary_types_allowed = True
        extra = Extra.forbid


class SearchNodes(BaseGraphDatabaseTool, BaseTool):
    """Tool for identifying related nodes in database."""

    name: str = "graph_db_nodes"
    description: str = """
    Input to this tool is a comma-separated list of terms, output is synonym search reasult representing term -> node mapping.

    Example Input: "table1, table2, table3"
    """

    def _run(
        self,
        terms: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Get related nodes for terms in a comma-separated list."""
        return self.db.get_table_info_no_throw(terms.split(", "))


class ShortestPathGraphDatabaseTool(BaseGraphDatabaseTool, BaseTool):
    """Tool for getting shortest paths between sets of nodes."""

    name: str = "graph_db_relationships"
    description: str = """
    Input to this tool is a comma-separated list of terms, output represents paths linking given nodes.
    """

    def _run(
        self,
        tool_input: str = "",
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Get the schema for a specific table."""
        return ", ".join(self.db.get_usable_table_names())

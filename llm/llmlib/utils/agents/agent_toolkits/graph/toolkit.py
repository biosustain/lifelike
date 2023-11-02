"""Toolkit for interacting with an Graph database."""
from typing import List

from langchain.agents.agent_toolkits.base import BaseToolkit
from langchain.pydantic_v1 import Field
from langchain.schema.language_model import BaseLanguageModel
from langchain.tools import BaseTool
from llmlib.utils.search.graph_search_api_wrapper import GraphSearchAPIWrapper

from llmlib.utils.tools.sql_database.tool import SearchNodes, ShortestPathGraphDatabaseTool


class GraphDatabaseToolkit(BaseToolkit):
    """Toolkit for interacting with Graph databases."""

    db: GraphSearchAPIWrapper = Field(exclude=True)
    llm: BaseLanguageModel = Field(exclude=True)

    class Config:
        """Configuration for this pydantic object."""

        arbitrary_types_allowed = True

    def get_tools(self) -> List[BaseTool]:
        """Get the tools in the toolkit."""
        nodes = SearchNodes(db=self.db)
        relationships = ShortestPathGraphDatabaseTool(db=self.db)
        return [
            nodes,
            relationships,
        ]

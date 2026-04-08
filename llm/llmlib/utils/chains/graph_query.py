from typing import Any, Dict, List, Optional, TypeVar, Generic

from langchain.callbacks.manager import CallbackManagerForChainRun
from langchain.pydantic_v1 import Field
from langchain.chains.base import Chain
from langchain.schema import BaseOutputParser

Graph = TypeVar("Graph")


class GraphQueryChain(Chain, Generic[Graph]):
    """Chain for converting terms to eid mappings"""

    graph: Graph = Field(exclude=True)
    graph_exception: Exception = Field(exclude=True, default=Exception)
    aliased_input_keys: List[str] = Field(
        alias='input_keys', default_factory=lambda: []
    )
    output_key: str = "results"  #: :meta private:
    output_parser: BaseOutputParser = None

    # Query to get term eids, input_keys are avaliable as query params
    query: str

    @property
    def input_keys(self) -> List[str]:
        return self.aliased_input_keys

    @property
    def output_keys(self) -> List[str]:
        return [self.output_key]

    def create_outputs(self, result: List[dict]) -> Dict[str, Any]:
        """Create outputs from response."""
        return {
            self.output_key: self.output_parser.parse_result(result)
            if self.output_parser
            else result
        }

    def _call(
        self,
        inputs: Dict[str, Any],
        run_manager: Optional[CallbackManagerForChainRun] = None,
    ) -> Dict[str, Any]:
        """
        Users can modify the following FindEidsChain Class Variables:

        :var top_k: The maximum number of AQL Query Results to return
        :type top_k: int
        """
        _run_manager = run_manager or CallbackManagerForChainRun.get_noop_manager()

        graph_result = []

        #####################
        # Execute Query #

        try:
            graph_result = self.graph.query(self.query, inputs)
        except self.graph_exception as e:
            _run_manager.on_text(
                "Graph Query Execution Error: ", end="\n", verbose=self.verbose
            )
            _run_manager.on_text(e, color="yellow", end="\n\n", verbose=self.verbose)
        else:
            _run_manager.on_text("Graph Result:", end="\n", verbose=self.verbose)
            _run_manager.on_text(
                str(graph_result), color="green", end="\n", verbose=self.verbose
            )
        #####################

        # Return results #
        return self.create_outputs(graph_result)

    @property
    def _chain_type(self) -> str:
        return "graph_query_chain"

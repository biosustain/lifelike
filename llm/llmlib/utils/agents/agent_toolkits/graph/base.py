"""Graph agent."""
from typing import Any, Dict, List, Optional, Sequence

from langchain.agents.agent import AgentExecutor, BaseSingleActionAgent
from llmlib.utils.agents.agent_toolkits.graph.toolkit import GraphDatabaseToolkit
from langchain.agents.agent_types import AgentType
from langchain.agents.mrkl.base import ZeroShotAgent
from langchain.agents.mrkl.prompt import FORMAT_INSTRUCTIONS
from langchain.agents.openai_functions_agent.base import OpenAIFunctionsAgent
from langchain.callbacks.base import BaseCallbackManager
from langchain.chains.llm import LLMChain
from langchain.prompts.chat import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
)
from langchain.schema.language_model import BaseLanguageModel
from langchain.schema.messages import AIMessage, SystemMessage
from langchain.tools import BaseTool


def create_graph_agent(
    llm: BaseLanguageModel,
    toolkit: GraphDatabaseToolkit,
    agent_type: AgentType = AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    callback_manager: Optional[BaseCallbackManager] = None,
    suffix: Optional[str] = None,
    format_instructions: str = FORMAT_INSTRUCTIONS,
    input_variables: Optional[List[str]] = None,
    max_iterations: Optional[int] = 15,
    max_execution_time: Optional[float] = None,
    early_stopping_method: str = "force",
    verbose: bool = False,
    agent_executor_kwargs: Optional[Dict[str, Any]] = None,
    extra_tools: Sequence[BaseTool] = (),
    **kwargs: Dict[str, Any],
) -> AgentExecutor:
    """Construct an Graph agent from an LLM and tools."""
    tools = toolkit.get_tools() + list(extra_tools)
    agent: BaseSingleActionAgent

    if agent_type == AgentType.ZERO_SHOT_REACT_DESCRIPTION:
        prompt = ZeroShotAgent.create_prompt(
            tools,
            format_instructions=format_instructions,
            input_variables=input_variables,
        )
        llm_chain = LLMChain(
            llm=llm,
            prompt=prompt,
            callback_manager=callback_manager,
        )
        tool_names = [tool.name for tool in tools]
        agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names, **kwargs)

    elif agent_type == AgentType.OPENAI_FUNCTIONS:
        messages = [
            SystemMessage(content=prefix),
            HumanMessagePromptTemplate.from_template("{input}"),
            AIMessage(content=suffix or GRAPH_FUNCTIONS_SUFFIX),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ]
        input_variables = ["input", "agent_scratchpad"]
        _prompt = ChatPromptTemplate(input_variables=input_variables, messages=messages)

        agent = OpenAIFunctionsAgent(
            llm=llm,
            prompt=_prompt,
            tools=tools,
            callback_manager=callback_manager,
            **kwargs,
        )
    else:
        raise ValueError(f"Agent type {agent_type} not supported at the moment.")

    return AgentExecutor.from_agent_and_tools(
        agent=agent,
        tools=tools,
        callback_manager=callback_manager,
        verbose=verbose,
        max_iterations=max_iterations,
        max_execution_time=max_execution_time,
        early_stopping_method=early_stopping_method,
        **(agent_executor_kwargs or {}),
    )

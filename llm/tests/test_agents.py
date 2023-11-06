import os

print('OPENAI_API_KEY', os.environ['OPENAI_API_KEY'])

from llmlib import Neo4j, app
from llmlib.v1 import graph_qa_v1


def test_agents():
    with app.app_context():
        response = graph_qa_v1(
            "What is the relationship between Zn2+ and glycolate?",
            graph=Neo4j().graph()
        )
        print(response)

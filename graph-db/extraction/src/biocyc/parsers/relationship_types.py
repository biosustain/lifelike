import re

from common.constants import REL_CITE, NODE_PUBLICATION, PROP_ID
from common.graph_models import RelationshipType

CITATIONS_RelationshipType = RelationshipType(
    REL_CITE, 'to', NODE_PUBLICATION, PROP_ID,
    lambda v: "PUB-" + re.search(r"\w+", v).group(0)
)

CITATIONS = {
    "CITATIONS": CITATIONS_RelationshipType,
    "^CITATIONS": CITATIONS_RelationshipType
}

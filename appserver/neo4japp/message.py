from dataclasses import dataclass, asdict
from typing import Optional, Tuple


@dataclass(repr=False, frozen=True)
class ServerMessage:
    title: Optional[str] = None
    message: Optional[str] = None
    additional_msgs: Tuple[str, ...] = tuple()

    def to_dict(self):
        return asdict(self)

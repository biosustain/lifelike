import itertools
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, List, Tuple, TypeVar, Callable, Iterable, Iterator, Union

from neo4japp.message import ServerMessage


@dataclass(repr=False, frozen=True)
class ContentValidationMessage(ServerMessage):
    pass


T = TypeVar('T')


class ContentValidationGroupedMessageFactory(ABC, Generic[T]):
    @property
    @abstractmethod
    def entity_type(self) -> T:
        """
        Type of entity in group that we are dealing with.
        This helps with typing and does not clutter outer scope
        :return: Type of entity
        """
        pass

    entities: List[T]

    def __init__(self):
        """
        Init entity list per instance
        """
        self.entities = []

    def __post_init__(self):
        """
        In case it extends dataclass __post_init__ is called in place of __init__
        :return:
        """
        ContentValidationGroupedMessageFactory.__init__(self)

    # region expose basic list properties - at the end this class only wrapping entity list
    def __len__(self):
        """
        Length of this class is the number of entities within it.
        Especially usefull for checking id it is truthfully `if ContentValidationGrouped:...`
        :return: Number of entities
        """
        return len(self.entities)

    def append(self, __object):
        """
        Add entity to the group
        :param __object: entity to be added
        :return: None
        """
        return self.entities.append(__object)

    # endregion

    # Default behaviour
    # def __nonzero__(self):
    #     return self.__len__

    @property
    def multiple(self):
        """
        Does the groupping contain multiple entities?
        :return: True - multiple, False - single, None - empty
        """
        return len(self.entities) > 1 if self.entities else None

    def compose(
        self,
        singular_factory: Callable[[T], str],
        multiple_factory: Callable[[int], str],
    ):
        """
        Show different text based on number of entities in the group
        :param singular_factory: given entity return str
        :param multiple_factory: given number of entities return str
        :return: result of singular or multiple callback based on number of entities
        """
        length = len(self.entities)
        if length > 1:
            return multiple_factory(length)
        if length == 1:
            return singular_factory(self.entities[0])
        raise ValueError('Trying to compose empty grouping message')

    def path(self, *args: Union[Union[str, int], Iterable[Union[str, int]]]):
        """
        Compose line "Path: <JSONPath>" based on args
        :param args: Path segments
        :return: "Path: <JSONPath>"
        """
        segments = (
            str(list(arg))
            if isinstance(arg, Iterable) and not isinstance(arg, str)
            else f'.{arg}'
            for arg in args
        )
        path = ''.join(segments).lstrip('.')
        return 'Path: ' + path

    @abstractmethod
    def entity_messages(self, entity: T) -> Tuple[str, ...]:
        """
        Compose list of string for singular entity
        :param entity: one of self.entities
        """
        pass

    def entities_messages(self) -> Iterator[str]:
        """
        Flatmap list of list of string for entities message into interable of strings
        :return:
        """
        return itertools.chain.from_iterable(
            map(lambda e: self.entity_messages(e), self.entities)
        )

    @abstractmethod
    def to_message(self) -> ContentValidationMessage:
        """
        Called to generate ContentValidationMessage once we get all group members
        :return:
        """
        pass

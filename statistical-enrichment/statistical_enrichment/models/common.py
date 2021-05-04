from ..util import snake_to_camel, camel_to_snake

class NEO4JBase:
    """ Base class for all neo4j related ORM """

    def to_dict(self, keyfn=None):
        d = self.__dict__
        keyfn = keyfn or snake_to_camel
        retval = {}
        for k in d:
            key = keyfn(k)
            retval[key] = d[k]
        return retval

    @classmethod
    def from_dict(cls, d, keyfn=None):
        keyfn = keyfn or camel_to_snake
        retval = {}
        for k in d:
            retval[keyfn(k)] = d[k]
        return cls(**retval)


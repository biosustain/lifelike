from neo4japp.utils import snake_to_camel_dict


class AttrDict(dict):
    """Wrap a python dictionary into an object"""

    def __init__(self, *args, **kwargs):
        super(AttrDict, self).__init__(*args, **kwargs)
        self.__dict__ = self

    def to_dict(self, exclude=[], snake_to_camel_transform=False):
        new_dict = {}

        if len(exclude):
            new_dict = {
                key: self.__dict__[key] for key in self.__dict__ if key not in exclude
            }
        else:
            new_dict = self.__dict__

        if snake_to_camel_transform:
            return snake_to_camel_dict(new_dict, {})
        else:
            return new_dict


def filter_dict_by_value(condition, d: dict):
    return {k: v for k, v in d.items() if condition(v)}


def compact(d):
    if isinstance(d, dict):
        return filter_dict_by_value(lambda v: v, d)
    raise NotImplementedError


__all__ = ['AttrDict', 'filter_dict_by_value', 'compact']

from typing import TypeVar, overload, Union

_T = TypeVar("_T")
_KT = TypeVar("_KT")
_VT = TypeVar("_VT")


class BiDict(dict[_KT, _VT]):
    @overload
    def get_key(self, __value: _VT) -> Union[_KT, None]:
        ...

    @overload
    def get_key(self, __value: _VT, __default: _KT) -> _KT:
        ...

    @overload
    def get_key(self, __value: _VT, __default: _T) -> Union[_KT, _T]:
        ...

    def get_key(self, value, default=None):
        for key in self:
            if self[key] == value:
                return key
        return default

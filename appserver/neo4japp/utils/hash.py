import hashlib
import json


def compute_hash(data: dict, **kwargs) -> str:
    """Returns the hash value of args"""
    h = hashlib.new(kwargs.get('alg') or 'sha256')
    to_json = json.dumps(data, sort_keys=True)
    h.update(bytearray(to_json, 'utf-8'))
    hexdigest = h.hexdigest()

    if 'limit' in kwargs:
        return hexdigest[: kwargs['limit']]
    return hexdigest


__all__ = ['compute_hash']

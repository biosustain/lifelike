from typing import Iterable

from neo4japp.models import Files


def get_missing_hash_ids(expected_hash_ids: Iterable[str], files: Iterable[Files]):
    found_hash_ids = set(file.hash_id for file in files)
    missing = set()
    for hash_id in expected_hash_ids:
        if hash_id not in found_hash_ids:
            missing.add(hash_id)
    return missing

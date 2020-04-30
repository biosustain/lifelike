from typing import Dict, List, Set, Tuple

from intervaltree import Interval, IntervalTree

from neo4japp.data_transfer_objects import Annotation
from neo4japp.util import compute_hash


class AnnotationInterval(Interval):
    def __init__(self, begin, end, data):
        super().__new__(Interval, begin=begin, end=end, data=data)


class AnnotationIntervalTree(IntervalTree):
    def __init__(self, intervals=None):
        super().__init__(intervals=intervals)

    def split_overlaps(self):
        """Finds all annotations with overlapping intervals."""
        if not self:
            return

        bounds = sorted(self.boundary_table)

        new_ivs = set()
        for lbound, ubound in zip(bounds[:-1], bounds[1:]):
            for iv in self[lbound]:
                new_ivs.add(Interval(lbound, ubound, iv.data))

        new_ivs = list(new_ivs)
        processed: Dict[Tuple[int, int], List[Annotation]] = {}
        returned_ivs: List[Annotation] = []

        for iv in new_ivs:
            interval = (iv.begin, iv.end)
            if interval in processed:
                processed[interval].append(iv.data)
            else:
                processed[interval] = [iv.data]

        processed_ivs: Set[str] = set()
        for _, annotations in processed.items():
            if len(annotations) > 1:
                for anno in annotations:
                    # need to compute hash here because the interval tree
                    # can return duplicate annotation
                    # because it groups into a tuple based on overlapping intervals
                    hashval = compute_hash(anno.to_dict())
                    if hashval not in processed_ivs:
                        returned_ivs.append(anno)

        return returned_ivs

    def overlap(self, begin, end):
        overlaps = super().overlap(begin, end)
        return [overlap.data for overlap in list(overlaps)]

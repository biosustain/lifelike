from intervaltree import Interval, IntervalTree


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
        if len(self.boundary_table) == 2:
            return

        bounds = sorted(self.boundary_table)

        new_ivs = set()
        for lbound, ubound in zip(bounds[:-1], bounds[1:]):
            for iv in self[lbound]:
                new_ivs.add(Interval(lbound, ubound, iv.data))

        new_ivs = [iv.data for iv in list(new_ivs)]
        return new_ivs

    def overlap(self, begin, end):
        overlaps = super().overlap(begin, end)
        return [overlap.data for overlap in list(overlaps)]

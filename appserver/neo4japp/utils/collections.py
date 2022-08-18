from itertools import islice


def find(predicate, seq):
    """Returns the first item in seq for which predicate(item) is True."""
    for item in seq:
        if predicate(item):
            return item
    return None


def find_index(predicate, seq):
    """Returns the index of the first item in seq for which predicate(item) is True."""
    for i, item in enumerate(seq):
        if predicate(item):
            return i
    return None


def window(seq, n=2):
    """Returns a sliding window (of width n) over data from the iterable."""
    # From: https://docs.python.org/2.3/lib/itertools-example.html
    it = iter(seq)
    result = tuple(islice(it, n))
    if len(result) == n:
        yield result
    for elem in it:
        result = result[1:] + (elem,)
        yield result

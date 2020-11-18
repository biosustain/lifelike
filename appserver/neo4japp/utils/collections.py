from itertools import islice


def window(seq, n=2):
    "Returns a sliding window (of width n) over data from the iterable"
    it = iter(seq)
    result = tuple(islice(it, n))
    if len(result) == n:
        yield result
    for elem in it:
        result = result[1:] + (elem,)
        yield result

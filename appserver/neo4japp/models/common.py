import itertools

class NEO4JBase():
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


def camel_to_snake(s):
    """Converts camelCase to snake_case.
    The SO (stackoverflow) answer has a simple function:
        import re
        def convert(name):
            s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
            return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
    But its performance can be improved by about 33% with this
    function, a simple hand translation of the regex matching
    algorithm.  Measured with timeit, speed improves from 122 ms to 78
    ms after 10K invocation
    """

    if not s:
        return s
    if len(s) == 1:
        return s.lower()

    buf = [s[0].lower()]
    prev_is_uppercase = s[0].isupper()

    normal, lookahead = itertools.tee(s[1:])
    next(lookahead)

    for c, ahead in itertools.zip_longest(normal, lookahead):
        if c.isupper():
            if not prev_is_uppercase or (ahead and ahead.islower()):
                buf.append('_')
            prev_is_uppercase = True
        else:
            prev_is_uppercase = False
        buf.append(c.lower())
    return ''.join(buf)


def snake_to_camel(s):
    if not s:
        return s
    parts = s.split('_')
    return parts[0] + ''.join(x.capitalize() or '_' for x in parts[1:])

from typing import Dict

from sqlalchemy import Column


def parse_sort(value: str, choices: Dict[str, Column], default_value: str):
    tokens = (value if value is not None and len(value) else default_value).split(',')
    columns = []

    for token in tokens:
        if not len(token):
            raise ValueError('bad sort token')
        if token[0] == '-':
            if not len(token) >= 2:
                raise ValueError('bad sort token')
            desc = True
            column_name = token[1:]
        elif token[1] == '+':
            if not len(token) >= 2:
                raise ValueError('bad sort token')
            desc = False
            column_name = token[1:]
        else:
            desc = False
            column_name = token

        if column_name in choices:
            column = choices[column_name]
            if desc:
                column = column.desc()
            else:
                column = column.asc()
            columns.append(column)

    return columns


def parse_page(value: str):
    if not value:
        return 1
    else:
        return max(1, int(value))


def parse_limit(value: str, upper: int, default_value: int = 10):
    if value is None:
        return default_value
    else:
        return min(upper, int(value))


def paginate_from_args(query, args, columns: Dict[str, Column],
                       default_sort: str, upper_limit: int):
    sort = parse_sort(args.get('sort'), columns, default_sort)
    page = parse_page(args.get('page'))
    limit = parse_limit(args.get('limit'), upper_limit)
    print(sort)
    return query \
        .order_by(*sort) \
        .paginate(page, limit, False)

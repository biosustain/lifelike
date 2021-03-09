import numpy as np
import pandas as pd
from scipy.stats.distributions import hypergeom


def fisher_p(k, M, n, N):
    """
    :param k: drawn type I objects
    :param M: total number of objects
    :param n: total number of type I objects
    :param N: draws without replacement
    :return: p
    """
    # return fisher_exact([[k, n-k], [N-k, M-(N+n-k)]], "greater")[1]
    # equivalent to using scipy.stats.fisher_exact:
    return hypergeom.cdf(n - k, M, n, M - N)


def fisher(geneNames, GOterms):
    """
    Run standard fisher's exact tests for each annotation term.
    """
    go = pd.DataFrame(GOterms)

    df = go.drop_duplicates(["geneName", "goId"])
    query = pd.unique(geneNames)
    df["query"] = np.in1d(df["geneName"], query).astype(float)
    M = df["geneName"].nunique()
    N = len(query)

    df = df.groupby("goId").agg(
            p_value=('query', lambda q: fisher_p(q.sum(), M, len(q), N)),
            geneNames=('geneName', lambda gn: list(gn[np.in1d(gn, query)])),
            goTerm=('goTerm', 'first'),
            goLabel=('goLabel', 'first')
    )

    df = df[df['p_value'] < 1].sort_values(by='p_value')

    df = df.reset_index().rename(columns={'p_value': 'p-value'})

    df['gene'] = df.apply(lambda m: f"{m['goTerm']} ({m['goId']})", axis=1)

    return df.to_json(orient='records')

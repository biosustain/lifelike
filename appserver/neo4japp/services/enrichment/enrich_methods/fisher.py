from time import time

import pandas as pd
from scipy.stats.distributions import hypergeom

from .utils.q_value import add_q_value


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


def fisher(geneNames, GOterms, related_go_terms_count):
    """
    Run standard fisher's exact tests for each annotation term.
    """
    df = pd.DataFrame(GOterms)
    query = pd.unique(geneNames)
    M = df["geneNames"].explode().nunique()
    N = len(query)

    fisher_time = 0

    def f(go):
        matching_gene_names = list(set(go["geneNames"]).intersection(query))
        s = time()
        go['p-value'] = fisher_p(len(matching_gene_names), M, len(go["geneNames"]), N)
        nonlocal fisher_time
        fisher_time += time() - s
        go['gene'] = f"{go['goTerm']} ({go['goId']})"
        go["geneNames"] = matching_gene_names
        return go

    df = df.apply(f, axis=1).sort_values(by='p-value')
    print(f"\t\tFisher calls took: {fisher_time}s")
    print(f"\t\tOne term fisher computation took on average: {fisher_time / len(df)}s")

    add_q_value(df, related_go_terms_count)
    return df.to_json(orient='records')

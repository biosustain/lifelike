import pandas as pd
from .utils.q_value import add_q_value
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


def fisher(geneNames, GOterms, related_go_terms_count):
    """
    Run standard fisher's exact tests for each annotation term.
    """
    df = pd.DataFrame(GOterms)

    if df.empty:
        return df.to_dict(orient='records')

    query = pd.unique(geneNames)

    M = df['geneNames'].explode().nunique()
    N = len(query)

    def f(go):
        matching_gene_names = list(set(go['geneNames']).intersection(query))
        go['p-value'] = fisher_p(len(matching_gene_names), M, len(go['geneNames']), N)
        if pd.isnull(go['p-value']):
            go['p-value'] = None
        go['gene'] = f"{go['goTerm']} ({go['goId']})"
        go['geneNames'] = matching_gene_names
        return go

    df = df.apply(f, axis=1).sort_values(by='p-value')

    add_q_value(df, related_go_terms_count)
    return df.to_dict(orient='records')

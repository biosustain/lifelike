from random import random

# !/usr/bin/env python3
import numpy as np
import pandas as pd
# from scipy.stats import fisher_exact
from scipy.stats.distributions import hypergeom


def wrap_with_random_p_value(g):
    return {
        "gene": g,
        "p-value": random()
    }


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


def main(query, ids, annotations):
    """
    Run standard fisher's exact tests for each annotation term.
    :param query: list of entity ids, e.g. NCBI entrez gene IDs. Must match ids in "ids" exactly.
    :param ids: list of ids for each annotation in "annotations"
    :param annotations: list of annotations for each id in "ids", e.g. GO terms, MeSH disease terms...
    :return: vector of unique annotation terms, vector of p-values
    """
    df = pd.DataFrame({"id": ids, "annotation": annotations}).drop_duplicates()
    query = pd.unique(query)
    df["query"] = np.in1d(df.id, query)
    M = df["id"].nunique()
    N = len(query)

    df.drop(columns="id", inplace=True)
    df = df.groupby("annotation").agg(lambda q: fisher_p(q.sum(), M, len(q), N))

    df.reset_index(inplace=True)
    return list(df["annotation"]), list(df["query"])


# EXAMPLE
if __name__ == '__main__':
    query = [1, 2, 5, 3]
    ids = [5, 2, 1, 5, 3, 5, 3, 2, 4]
    annotations = ["A", "A", "B", "B", "A", "B", "C", "C", "C"]
    a, p = main(query, ids, annotations)
    print(a)
    print(p)
    

def fisher(geneNames, GOterms, *args, **kwargs):
    return list(map(wrap_with_random_p_value, geneNames))


def binom(geneNames, GOterms, *args, **kwargs):
    return list(map(wrap_with_random_p_value, geneNames))

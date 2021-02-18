from random import random

import numpy as np
import pandas as pd
from scipy.stats.distributions import hypergeom

import pandas as pd
from scipy.stats.distributions import binom

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
    df = pd.DataFrame({ "id": ids, "annotation": annotations }).drop_duplicates()
    query = pd.unique(query)
    df["query"] = np.in1d(df.id, query)
    M = df["id"].nunique()
    N = len(query)

    df.drop(columns="id", inplace=True)
    df = df.groupby("annotation").agg(lambda q: fisher_p(q.sum(), M, len(q), N))

    df.reset_index(inplace=True)
    return list(df["annotation"]), list(df["query"])


def statistically_significat(r):
    return r < 0.05

def fisher(geneNames, GOterms, *args, **kwargs):
    go = pd.DataFrame(GOterms)
    goGenes = go["geneName"]
    goId = go['goId']
    # gene, p = main(geneNames, goGenes, goId)


    df = pd.DataFrame({ "id": goGenes, "annotation": goId }).drop_duplicates()
    query = pd.unique(geneNames)
    df["query"] = np.in1d(df.id, query).astype(float)
    M = df["id"].nunique()
    N = len(query)

    df.drop(columns="id", inplace=True)
    df = df.groupby("annotation").agg(lambda q: fisher_p(q.sum(), M, len(q), N))

    df = df[df['query'] < 1].sort_values(by='query')
    df['query'] = df['query']
    merged = df.merge(go.drop_duplicates(subset=['goId']), 'left', left_index=True, right_on="goId")

    merged['p-value'] = merged['query'].astype(float)
    merged['gene'] = merged.apply(lambda m: f"{m['goTerm']} ({m['goId']})", axis=1)

    return merged.to_json(orient='records')

    # r = list(map(lambda gp: { "gene": gp[0], "p-value": -np.log10(gp[1]) }, zip(gene, p)))
    # return r


def binom_p(x, n, N, M):
    """
    Get a p-value from a binomial test.
    :param x: number of successful trials
    :param n: number of trials
    :param N: number of objects that if selected is considered a successful trial
    :param M: total number of objects to select
    :return: float p-value
    """
    # equivalent to using scipy.stats.binom_test
    return binom.sf(x - 1, n, N / M)


def binom_main(query, counts, ids, annotations):
    """
    Run standard fisher's exact tests for each annotation term.
    :param query: list of entity ids, e.g. NCBI entrez gene IDs. Must match ids in "ids" exactly.
    :param counts: number of repeated observations for each of the ids in "query".
    :param ids: list of ids for each annotation in "annotations"
    :param annotations: list of annotations for each id in "ids", e.g. GO terms, MeSH disease terms...
    :return: vector of unique annotation terms, vector of p-values
    """
    M = len(pd.unique(ids))
    n = sum(counts)

    df = pd.DataFrame({ "id": ids, "annotation": annotations }).drop_duplicates().set_index("id")
    df = pd.DataFrame({ "id": query, "count": counts }).groupby("id").sum().join(df, how="right").reset_index()
    df = df.groupby("annotation").apply(lambda g: binom_p(g["count"].sum(), n, g["id"].nunique(), M))

    return list(df.index), list(df)


def binomial(geneNames, GOterms, *args, **kwargs):
    go = pd.DataFrame(GOterms)
    goGenes = go["geneName"]
    goId = go['goId']
    gene, p = binom_main(geneNames, list(map(lambda g: 1, geneNames)), goGenes, goId)
    r = list(map(lambda gp: { "gene": gp[0], "p-value": -np.log10(gp[1]) }, zip(gene, p)))
    return r

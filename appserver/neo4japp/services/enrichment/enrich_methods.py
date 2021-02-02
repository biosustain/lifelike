from random import random


def wrap_with_random_p_value(g):
    g["p-value"] = random()
    return g


def fisher(geneNames, GOterms, *args, **kwargs):
    return list(map(wrap_with_random_p_value, geneNames))


def binom(geneNames, GOterms, *args, **kwargs):
    return list(map(wrap_with_random_p_value, geneNames))

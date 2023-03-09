import numpy as np
import pandas as pd
from statsmodels.stats.multitest import fdrcorrection


def add_q_value(df, related_go_terms_count, inplace=True):
    p_values = df['p-value']
    extended_p_values = p_values.append(
        pd.Series(
            np.ones(related_go_terms_count - len(p_values))
        )
    )
    r = fdrcorrection(extended_p_values, method='indep')
    if inplace:
        df['rejected'] = r[0][:len(p_values)]
        df['q-value'] = r[1][:len(p_values)]
    else:
        return r

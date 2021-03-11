from statsmodels.stats.multitest import fdrcorrection


def add_q_value(df, inplace=True):
    r = fdrcorrection(df['p-value'], method='indep')
    if inplace:
        df['rejected'] = r[0]
        df['q-value'] = r[1]
    else:
        return r

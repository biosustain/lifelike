#!/usr/bin/env julia
using ArgParse
using DataFrames, DataFramesMeta, CSV
using HypothesisTests, MultipleTesting
using Distributions

"""
A version of pvalue(x::ApproximateMannWhitneyUTest; tail) with log transformed built in to handle very small p-values.
https://github.com/JuliaStats/HypothesisTests.jl/blob/master/src/mann_whitney.jl
"""
function logpvalue(x::ApproximateMannWhitneyUTest; tail=:both)
    if x.mu == x.sigma == 0
        log(1)
    else
        if tail == :both
            log(2) + logccdf(Normal(), abs(x.mu - 0.5 * sign(x.mu))/x.sigma)
        elseif tail == :left
            logcdf(Normal(), (x.mu + 0.5)/x.sigma)
        elseif tail == :right
            logccdf(Normal(), (x.mu - 0.5)/x.sigma)
        end
    end
end

"""
Simple wrapper around MultipleTesting.adjust that takes log(p) values and makes sure extremely small p-values are not converted to zero.
Returns log(adjusted p)
"""
function logadjust(logpValues::Array{T,1}, method::M) where {T<:AbstractFloat, M<:PValueAdjustment}
    logpValues .|> BigFloat .|> exp |> ps->adjust(ps, method) .|> log .|> Float64
end
function logadjust(logpValues::Array{T,1}, n::Integer, method::M) where {T<:AbstractFloat, M<:PValueAdjustment}
    logpValues .|> BigFloat .|> exp |> ps->adjust(ps, n, method) .|> log .|> Float64
end

"""
Calculate Mann-Whitney U Test for annotations of ids. Ids of interest given in stdin.
annotation_file - Table with annotations.
            required = true
annotation - Name of column with annotation terms to test enrichment for, e.g. GO.
            required = true
value - Name of column with values with undetermined distribution, e.g. counts.
            required = true
id - Name of column with ids to match against the infile.
            required = true
header - Set if infile has a header. Then ids are read from column with name -i/--id.
            action = :store_true
group - Grouping column name. Not implemented yet.
BH - Set flag to calculate Benjamini-Hochberg corrected p-values. Provide a value to set a threshold for filtering, e.g 0.05.
            nargs = '?'
            arg_type = Float64
            constant = 1.
bonf - Set flag to calculate Bonferroni corrected p-values. Provide a value to set a threshold for filtering, e.g 0.05.
            nargs = '?'
            arg_type = Float64
            constant = 1.
zeros - If the values are counts then you can set this flag to consider any absent id annotation as having value=0.
            action = :store_true
log - Log transform p-values, if they are very small.
            action = :store_true
optim - Optimize performance by filtering out annotation that will definitely not be enriched, which is the case if zero ids-of-interest has that annotation.
            action = :store_true
"""
function calculateMannWhitney(df, ids; annotation, value, id, header=true, group, BH, bonf, zeros, log, optim)

    @info "Mark ids-of-interest."
    df.X = df[!, id] .∈ Ref(Set(ids))
    # A Mann-Whitney U test requires two samples to compare.
    all(df.X) && error("All annotations belong to the ids from the infile.")
    !any(df.X) && error("No annotations belong to the ids from the infile.")


    if optim
        potential = DataFrame(annotation=>unique(df[df.X, annotation]))
        @info "Reduce set of potential annotation from $(length(unique(df[!, annotation]))) to $(nrow(potential))"
        df = innerjoin(potential, df, on=annotation)
    end

    if zeros
        @info "Introduce zero counts."
        df = coalesce.(unstack(df, [id, "X"], annotation, value), 0)
        # has to be done in two steps, it gives a wrong result if line of code above and below are combined.
        df = stack(df, 3:size(df,2); variable_name=annotation, value_name=value)
    end

    # log settings
    getp, getpadj, p_name, q_name, bonf_name = log ? (logpvalue, logadjust, "logp", "logq", "logp_bonf") : (pvalue, adjust, "p", "q", "p_bonf")

    @info "Group by test."
    gdf = groupby(df, annotation)
    @info "Run Mann-Whitney U Tests and keep the p-values."
    results = DataFrames.combine(gdf, [value, "X"] => ((v, X) -> getp(MannWhitneyUTest(v[X], v[.!X]), tail=:right)) => p_name)
    BH === nothing || (results[!, q_name] = getpadj(results[!, p_name], n_tests, BenjaminiHochberg()))
    bonf === nothing || (results[!, bonf_name] = getpadj(results[!, p_name], n_tests, Bonferroni()))

    # filter

    if BH !== nothing && BH < 1.
        if log BH = log(BH) end
        @info "filtering results with significance threshold $q_name<=$(BH)."
        results = results[results[!, q_name] .<= BH, :]
    end

    if bonf !== nothing && bonf < 1.
        if log bonf = log(bonf) end
        @info "filtering results with significance threshold $bonf_name<=$(bonf)."
        results = results[results[!, bonf_name] .<= bonf, :]
    end

    @info "Sort."
    DataFrames.sort!(results, filter(n->n ∈ names(results), [bonf_name, q_name, p_name]))
    return results
end



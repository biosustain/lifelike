#!/usr/bin/env Rscript
#' use binomial test to do OverRepresentation analysis of annotations, e.g. GO terms.
#' Use for genes-of-interst data with gene (node) counts, i.e. the same genes are sampled multiple times.
#' This means we are sampling with replacement so we use Binomial test instead of Fisher's test.
#' loose EXAMPLE:
#' binomial_ORA.R GO_annotations.tsv -g "drug"/"disease"/etc. -c "numPubs" < publication_counts.tsv
#' where publication_counts.tsv has a single column "numPubs" with integers and a column that matches one in GO_annotations.tsv
library(data.table)

#' bonferroni correction of log(p)
bonferroni.log <- function(log.p) {
    # bonferroni is alpha_bonferroni <- alpha_level / n_tests, aka.
    # p_bonferroni <- min(1, p * n_tests). So
    # p_bonferroni.log <- min(log10(1), log.p + log10(n_tests))
    pmin(0, log.p + log10(length(log.p)))
}

#' Benjamini-Hochberg (FDR) correction of log(p).
#' code taken from p.adjust and log10 terms added
BH.log <- function(log.p) {
    n <- length(log.p)
    i <- n:1
    o <- order(log.p, decreasing=T)
    ro <- order(o)
    pmin(0, cummin(log10(n/i) + log.p[o]))[ro]
}

#' get the p-value from a binomial test where you have counts observed for some ids
#' and want to know if they are overrepresented among a set of "success" ids vs a background of all ids.
#' Example: For a set of genes of interest (GOI) each observed a number of times,
#' if we sample randomly that many times with replacement from all genes,
#' what is then the probability of getting as much success as observed for the GOIs?
#' - counts.DT: data.table with columns "id", "count" for number of observations for each of the ids
#' - success_ids: ids that is considered a successful trial, e.g. ids that are annotated with a GO term being tested for.
#' - n_total_ids: number of total ids so that number of background ids + success_ids == n_total_ids
binomial.p <- function(counts.DT, success_ids, n_total_ids, log.p=F) {
    success_ids <- unique(success_ids)  # just in case
    n_successes <- counts.DT[id%in%success_ids, sum(count)]
    n_trials <- counts.DT[,sum(count)]
    p_success <- length(success_ids)/n_total_ids
    # minus 1 is from expression for alternative hypothesis "greater", see code of binom.test
    return(pbinom(n_successes-1, n_trials, p_success, lower.tail=F, log.p=log.p))
}

#' @export
#' @param annotations
#' @param id - Column name in infile containing ids. By default it is guessed.
#' @param count - Column name in infile containing counts. Required.
#' @param annotation - Column name containing annotation terms to test enrichment for, e.g. GO. Required.
#' @param group - Column name containing grouping label. Default is doing a single ORA for all data.
#' @param Return enriched data
binom.enrich <- function(
        genes=list(),
        annotations=list(),
        q.threshold=0.05
) {
    print(annotations)
    print(genes)
    print(q.threshold)

    return({})

# <- function(annotations, id, count, counts, annotation, group) {
    if(is.null(id)) {
        # most likely the column with unique geneIDs
        map.col <- intersect(colnames(counts), colnames(annotations))[1]
    } else {
        map.col <- id
    }
    annotation_ids <- unique(annotations[[map.col]])
    n_ids <- length(annotation_ids)

    # helper function. Given a table with columns "id", "count"
    # get a table with columns "enrich", "p" for the p-value of enrichment for each enrich term (usually GO)
    enrich <- function(counts.sum) {
        annotations[, .(log.p=binomial.p(counts.sum, get(map.col), n_ids, log.p=T)), by=.(enrich=get(annotation))]
    }
    # summarize counts and do enrichment analysis either ungrouped or grouped
    if(group == '') group <- NULL
    if(is.null(group)) {
        counts.sum <- counts[, .(count=sum(get(count))), by=.(id=get(map.col))]
        results <- enrich(counts.sum)
    } else {
        counts.sum <- counts[, .(count=sum(get(count))), by=.(group=get(group), id=get(map.col))]
        results <- counts.sum[, enrich(.SD), by=group]
    }

    n_tests <- nrow(results)
    results$log.p_bonf <- bonferroni.log(results$log.p)
    results$log.q <- BH.log(results$log.p)
    results <- results[log.q < log10(0.05)][order(log.q)]
    n_signif <- c(nrow(results), results[log.p_bonf < log10(0.05), .N])
    percent <- n_signif / n_tests * 100
    message(n_signif[1], " significant tests (BH) out of ", n_tests, " (", formatC(percent[1], 3, format="f", drop0trailing=T),"%).")
    message(n_signif[2], " significant tests (Bonferroni) out of ", n_tests, " (", formatC(percent[2], 3, format="f", drop0trailing=T),"%).")

    # revert names back to original naming
    setnames(results, "enrich", annotation)
    if(!is.null(group)) setnames(results, "group", group)

    return(results)
}

#!/usr/bin/env Rscript
library(plumber)
library(data.table)

#' read gene list of interest (GOI) from stdin and write enrichment table to stdout.
#' You can use merge.R -s and a synonym2object.tsv to convert gene symbols to GO object IDs.
#' Take a single positional arg with a table of GO annotations, at least columns "GO" and one with the id.
#' also takes a required positional arg with the column name for ids found in both infile and the GO annotation table.
#' Can be used for other annotation than specifically GO annotation by setting arg -a/--annotation

#' fisher's test using x, m, n, k naming like dhyper.
#' this function is identical to phyper(x-1, m, n, k, lower.tail=F)
fisher.p <- function(x, m, n, k) {
    contingency <- matrix(c(x, k-x, m-x, n+x-k), 2, 2)
    return(fisher.test(contingency, alternative="greater")$p.value)
}

#' get table with columns annotation, p, q for enriched annotation terms.
#' annotations: table that contains columns id.col, annotation.col
#' gois: genes of interest. names found in id.col column of annotation table.
#' id.col: string name of column with ids to match
#' q.threshold: threshold for q-value signifying significance
enriched <- function(annotations, gois, id.col, annotation.col, q.threshold=0.05) {
    # easiest to just change variable col name to string "id"
    annotations <- copy(annotations)
    setnames(annotations, id.col, "id")
    setnames(annotations, annotation.col, "annotation")
    # discard other columns and remove duplicate rows
    annotations <- unique(annotations[,.(id, annotation),])
    m <- length(gois)
    n <- length(unique(annotations$id)) - m
    annotation.ps <- annotations[, .(p=fisher.p(sum(id%in%gois), m, n, .N)), by=annotation]
    annotation.ps$q <- p.adjust(annotation.ps$p, "fdr")
    out <- annotation.ps[q <= q.threshold][order(q, p)]
    setnames(out, "annotation", annotation.col)
    return(out)
}

#' @export
#' @param annotations
#' @param id - Column name in infile containing ids. By default it is guessed.
#' @param header
#' @param annotation - Column name containing annotation terms to test enrichment for, e.g. GO. Required.
#' @param group
#' @param GOIs
#' @param thes
#' @param Return enriched data
#' @post /enrich
enrich <- function(id, group, header, annotations, annotation="GO", GOIs, thes=0.05) {
    GOIs <- GOIs[[id]]
    result <- enriched(annotations, GOIs, id, annotation, thres)
    return(result)
}

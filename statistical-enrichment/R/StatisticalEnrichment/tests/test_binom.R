source("./R/binom.R", chdir = TRUE)
library(testthat)

test_that("simple use case", {
  annotations = fread("assets/npub_date10_disease-mesh.tsv")
  counts = fread("assets/cagpapers.tsv")
  count = "npub"
  annotation = "npub"
  opts = list(id = "entrez", group = "mesh", header = T)
  id = "entrez"
  group <- "symbol"

  if (is.null(opts$id)) {
    # most likely the column with unique geneIDs
    map.col = intersect(colnames(counts), colnames(annotations))[1]
  } else {
    map.col = opts$id
  }
  annotation_ids = unique(annotations[[map.col]])
  n_ids = length(annotation_ids)
  count_ids = unique(counts[[map.col]])
  notfound = count_ids[!count_ids %in% annotation_ids]
  if (length(notfound) > 0) {
    percent = length(notfound) / length(count_ids) * 100
    message(length(notfound), " out of ", length(count_ids), " ids without annotation (", formatC(percent, 3, format = "f", drop0trailing = T), "%).")
  }
  # discard
  counts = counts[!get(map.col) %in% notfound]

  expect_true(binom.enrich(annotations, id, count, counts, annotation, group))
})

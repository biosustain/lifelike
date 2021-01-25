source("./R/fisher.R", chdir = TRUE)
library(testthat)

test_that("simple use case", {
  annotations = fread("assets/npub_date10_disease-mesh_total.tsv")
  counts = fread("assets/cagpapers.tsv")
  count = "npub"
  annotation = "npub"
  opts = list(id = "entrez", group = "mesh", header = T)
  group <- "mesh"
  header = T

  expect_true(fisher.enrich(annotations, GOIs, group))
})

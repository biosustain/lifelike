library(plumber)
source("./fisher.R")
source("./binom.R")

pr() %>%
  pr_get("/healtz", function() {
    "<html><h1>I am OK!</h1></html>"
  }, serializer = plumber::serializer_html()) %>%
  pr_post("/fisher/enrich",
          fisher.enrich,
          parsers = "json",
          params = list(
            "annotations" = list(type = "object", desc = "{annotation,id}", required = FALSE, isArray = TRUE),
            "GOIs" = list(type = "str", desc = "A file", required = FALSE, isArray = TRUE),
            "q.threshold" = list(type = "float", desc = "A file", required = FALSE, isArray = FALSE)
          ),
          comments = "Get table with columns annotation, p, q for enriched annotation terms."
  ) %>%
  pr_post("/binom/enrich",
          binom.enrich,
          parsers = "json",
          params = list(
            "annotations" = list(type = "object", desc = "{annotation,id}", required = FALSE, isArray = TRUE),
            "GOIs" = list(type = "str", desc = "A file", required = FALSE, isArray = TRUE),
            "q.threshold" = list(type = "float", desc = "A file", required = FALSE, isArray = FALSE)
          ),
          comments = "get the p-value from a binomial test where you have counts observed for some ids"
  ) %>%
  pr_run()

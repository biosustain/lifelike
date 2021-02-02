library(StatisticalEnrichment)
#
# generate_json_service <- function(parse_args, service) {
#   return(function(req, res) {
#     tryCatch(
#     {
#       # parse the JSON string from the post body
#       data <- jsonlite::fromJSON(req$postBody)
#       kwargs <- parse_args(data)
#       print(req$postBody)
#
#       tryCatch(
#       {
#         res$body <- jsonlite::toJSON(
#           do.call(service, kwargs),
#           auto_unbox = TRUE
#         )
#         res$status <- 200
#       },
#         error = function(cond) {
#           res$body <- jsonlite::toJSON(
#           { "error":cond },
#           auto_unbox = TRUE
#           )
#           res$status <- 500
#         },
#         warning = function(cond) {
#           res$body <- jsonlite::toJSON(
#           { "warning":cond },
#           auto_unbox = TRUE
#           )
#           res$status <- 200
#         },
#         finally = {
#         }
#       )
#     },
#       error = function(cond) {
#         res$body <- jsonlite::toJSON(
#         { "error":cond },
#         auto_unbox = TRUE
#         )
#         res$status <- 400
#       },
#       warning = function(cond) {
#         res$body <- jsonlite::toJSON(
#         { "warning":cond },
#         auto_unbox = TRUE
#         )
#         res$status <- 200
#       },
#       finally = {
#       }
#     )
#     return(res)
#   })
# }

#* @get /
#* @post /
#* @get /healtz
#* @post /healtz
#* @serializer html
function(req, res) {
  print(req$postBody)
  res$body <- "I'm OK"
  res$status <- 200
  res
}

#* @post /update
function(req, res) {
  tryCatch(
  {
    # parse the JSON string from the post body
    data <- jsonlite::fromJSON(req$postBody)

    type <- data$type
    l <- data$list

    print(data)

    tryCatch(
    {
      res$body <- jsonlite::toJSON(
        update(type, l),
        auto_unbox = TRUE
      )
      res$status <- 200
    },
      error = function(cond) {
        print(cond)
        res$body <- jsonlite::toJSON(
        { "errors":cond },
        auto_unbox = TRUE
        )
        res$status <- 500
      },
      warning = function(cond) {
        res$body <- jsonlite::toJSON(
        { "warnings":cond },
        auto_unbox = TRUE
        )
        res$status <- 200
      },
      finally = {
      }
    )
  },
    error = function(cond) {
      res$body <- jsonlite::toJSON(
      { "errors":cond },
      auto_unbox = TRUE
      )
      res$status <- 400
    },
    warning = function(cond) {
      res$body <- jsonlite::toJSON(
      { "warnings":cond },
      auto_unbox = TRUE
      )
      res$status <- 200
    },
    finally = {
    }
  )
  return(res)
}

#* @post /fisher/enrich
#* Get table with columns annotation, p, q for enriched annotation terms.
function(req, res) {
  tryCatch(
  {
    # parse the JSON string from the post body
    data <- jsonlite::fromJSON(req$postBody)

    type <- data$type
    entities <- data$entities
    q.threshold <- data$qThreshold

    print(data)

    tryCatch(
    {
      res$body <- jsonlite::toJSON(
        fisher.enrich(entities, type, q.threshold),
        auto_unbox = TRUE
      )
      res$status <- 200
    },
      error = function(cond) {
        print(cond)
        res$body <- jsonlite::toJSON(
        { "errors":cond },
        auto_unbox = TRUE
        )
        res$status <- 500
      },
      warning = function(cond) {
        res$body <- jsonlite::toJSON(
        { "warnings":cond },
        auto_unbox = TRUE
        )
        res$status <- 200
      },
      finally = {
      }
    )
  },
    error = function(cond) {
      res$body <- jsonlite::toJSON(
      { "errors":cond },
      auto_unbox = TRUE
      )
      res$status <- 400
    },
    warning = function(cond) {
      res$body <- jsonlite::toJSON(
      { "warnings":cond },
      auto_unbox = TRUE
      )
      res$status <- 200
    },
    finally = {
    }
  )
  return(res)
}

#* @post /binom/enrich
#* get the p-value from a binomial test where you have counts observed for some ids
function(req, res) {
  tryCatch(
  {
    # parse the JSON string from the post body
    data <- jsonlite::fromJSON(req$postBody)

    annotations <- data$annotations
    genes <- data$GOIs
    q.threshold <- data$qThreshold

    print(data)

    tryCatch(
    {
      res$body <- jsonlite::toJSON(
        binom.enrich(genes, annotations, q.threshold),
        auto_unbox = TRUE
      )
      res$status <- 200
    },
      error = function(cond) {
        print(cond)
        res$body <- jsonlite::toJSON(
        { "errors":cond },
        auto_unbox = TRUE
        )
        res$status <- 500
      },
      warning = function(cond) {
        res$body <- jsonlite::toJSON(
        { "warnings":cond },
        auto_unbox = TRUE
        )
        res$status <- 200
      },
      finally = {
      }
    )
  },
    error = function(cond) {
      res$body <- jsonlite::toJSON(
      { "errors":cond },
      auto_unbox = TRUE
      )
      res$status <- 400
    },
    warning = function(cond) {
      res$body <- jsonlite::toJSON(
      { "warnings":cond },
      auto_unbox = TRUE
      )
      res$status <- 200
    },
    finally = {
    }
  )
  return(res)
}

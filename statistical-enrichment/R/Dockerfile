FROM rocker/r-ver:4.0.1
WORKDIR /app
COPY . .
RUN R -e "install.packages('remotes'); \
          remotes::install_deps('StatisticalEnrichment', dependencies = TRUE); \
          remotes::install_local('StatisticalEnrichment');"
RUN R CMD check StatisticalErnrichment --no-manual
EXPOSE 3000
CMD ["R", "-e", "r <- plumber::plumb()$run(host = '0.0.0.0', port = 3000, swagger=TRUE)"]

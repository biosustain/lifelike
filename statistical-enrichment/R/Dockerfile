FROM rocker/r-ver:4.0.1

RUN mkdir /home/analysis
WORKDIR /home/analysis

RUN Rscript -e "install.packages('plumber')"
RUN Rscript -e "install.packages('data.table')"
RUN Rscript -e "install.packages('testthat')"

RUN R -e 'install.packages(".", repos = NULL, type="source", dependencies=TRUE)'

COPY . .

CMD R -e 'plumber::plumb(dir="R")$run(port = 5762)'

RUN Rscript -e "testthat::test_dir('tests')"

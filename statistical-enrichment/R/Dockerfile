FROM rocker/r-ver:4.0.1

RUN mkdir /home/analysis
WORKDIR /home/analysis

RUN Rscript -e "install.packages('plumber')"
RUN Rscript -e "install.packages('data.table')"

RUN R -e 'install.packages(".", repos = NULL, type="source", dependencies=TRUE)'

COPY . .

CMD R -e 'plumber::plumb("NAMESPACE")$run(port = 5762)'

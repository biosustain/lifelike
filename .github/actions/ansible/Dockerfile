FROM alpine:latest
LABEL app=kg-prototypes

ENV ANSIBLE_HOST_KEY_CHECKING=False

RUN apk add ansible python3-dev gcc

COPY entrypoint.sh ./entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]

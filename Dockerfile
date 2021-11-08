FROM node:16-alpine

EXPOSE 8080

COPY docker-init.sh /

ENTRYPOINT [ "sh", "/docker-init.sh" ]


ARG BASE_IMAGE=alpine
ARG BASE_IMAGE_TAG=3.14

FROM ${BASE_IMAGE}:${BASE_IMAGE_TAG} AS base
WORKDIR /home/app
ARG NODE_VER=14.20.1-r0
RUN apk add --no-cache \
    nodejs=${NODE_VER} \
    curl \
    && rm -rf /var/cache/apk/*


FROM base AS src
HEALTHCHECK --interval=5s --timeout=2s --start-period=5s \
    CMD exit $(curl -sS http://localhost/healthcheck; echo $?)
ARG NPM_VER=7.17.0-r0
ARG PM2_VER=5.1.1
RUN apk add --no-cache npm=${NPM_VER} && rm -rf /var/cache/apk/* \
    && npm install -g pm2@${PM2_VER} --only=prod --no-optional --no-package-lock
COPY package.json /home/app/package.json
RUN npm install --only=prod --no-optional --no-package-lock \
    && cp -R node_modules prod_mods \
    && npm install --no-optional
COPY src /home/app/src
RUN mkdir -p /home/app/pub \
    && cp src/html/* /home/app/pub/ \
    && npm run release
COPY server /home/app/server
COPY docker-compose.yml /home/app/docker-compose.yml
ENTRYPOINT ["pm2-dev", "server/pm2.config.js"]
EXPOSE 80 443
CMD [""]


FROM base AS prod
HEALTHCHECK --interval=10s --timeout=2s --start-period=30s \
    CMD exit $(curl -sS http://localhost/healthcheck; echo $?)
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
COPY --from=src /usr/local/lib/node_modules/pm2 /usr/local/lib/node_modules/pm2
RUN ln -s /usr/local/lib/node_modules/pm2/bin/pm2* /usr/bin
COPY --from=src /home/app/prod_mods /home/app/node_modules
COPY --from=src /home/app/package-lock.json /home/app/package-lock.json
COPY --from=src /home/app/server /home/app/server
COPY --from=src /home/app/pub /home/app/pub
COPY --from=src /home/app/src/html/ /home/app/pub/
COPY --from=src /home/app/docker-compose.yml /home/app/docker-compose.yml
ENTRYPOINT ["pm2-runtime", "server/pm2.config.js"]
EXPOSE 80 443
CMD [""]

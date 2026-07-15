FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV FDE_EXECUTION_BOUNDARY=separate-container
ENV FDE_DATA_DIR=/var/lib/fde

RUN apk add --no-cache git

COPY execution-plane/package.json ./package.json
COPY execution-plane/server.mjs ./server.mjs
COPY execution-plane/demo-runner.mjs ./demo-runner.mjs
COPY execution-plane/workspace-demo-runner.mjs ./workspace-demo-runner.mjs
COPY execution-plane/platform-runtime.mjs ./platform-runtime.mjs
COPY execution-plane/persistence.mjs ./persistence.mjs
COPY execution-plane/platform-core.mjs ./platform-core.mjs
COPY execution-plane/github-app.mjs ./github-app.mjs
COPY execution-plane/sandbox-gateway.mjs ./sandbox-gateway.mjs
COPY execution-plane/credential-broker.mjs ./credential-broker.mjs
COPY execution-plane/workspace-registry.mjs ./workspace-registry.mjs
COPY execution-plane/workspace-preparer.mjs ./workspace-preparer.mjs
COPY execution-plane/templates ./templates

RUN mkdir -p /var/lib/fde /workspaces && chown -R node:node /var/lib/fde /workspaces /app

USER node
EXPOSE 8787
CMD ["node", "server.mjs"]

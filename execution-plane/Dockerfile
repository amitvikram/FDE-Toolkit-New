FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV FDE_EXECUTION_BOUNDARY=separate-container

COPY execution-plane/package.json ./package.json
COPY execution-plane/server.mjs ./server.mjs
COPY execution-plane/demo-runner.mjs ./demo-runner.mjs

USER node
EXPOSE 8787
CMD ["node", "server.mjs"]

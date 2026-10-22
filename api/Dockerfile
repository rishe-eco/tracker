FROM node:24-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# Data directory for the SQLite DB; a named volume mounts here at runtime (see docker-compose.yml)
RUN mkdir -p /app/data

# Set after the build, so `npm ci` above still installs the dev dependencies tsc needs.
# Apollo reads it: no stack traces in GraphQL errors (src/graphql/errorPolicy.ts).
ENV NODE_ENV=production

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
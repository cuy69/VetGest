FROM node:22-alpine AS dependencies
WORKDIR /app
RUN npm install --global pnpm@10.15.1
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS test
COPY . .
CMD ["sh", "-c", "pnpm test && pnpm lint && pnpm build"]

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM nginx:1.28-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

FROM mcr.microsoft.com/playwright:v1.55.0-noble AS e2e
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY playwright.config.ts .
COPY e2e ./e2e
CMD ["node", "node_modules/@playwright/test/cli.js", "test"]

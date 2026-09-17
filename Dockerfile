# Multi-stage production container for Metinous AI Backend & Frontends
FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code and bundled Flutter frontends
COPY . .

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=2134

EXPOSE 2134

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

CMD ["node", "server.js"]

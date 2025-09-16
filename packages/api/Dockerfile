# Multi-stage build for Node.js/NestJS application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY ./packages/api/package*.json ./

# Install all dependencies (including dev for build)
RUN npm install && npm cache clean --force

# Copy source code and shared scripts
COPY ./packages/api .
COPY ./packages/shared ./shared

# Build the application
RUN npm run build && find dist/ -name "*.js" | head -10

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY ./packages/api/package*.json ./

# Install production dependencies + tools needed for migrations
RUN npm install --omit=dev && \
    npm install drizzle-kit ts-node typescript && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/src/health-check.js ./
COPY --from=builder --chown=nestjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nestjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nestjs:nodejs /app/tsconfig*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/shared ./shared

# Create uploads directory
RUN mkdir -p uploads && chown nestjs:nodejs uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node health-check.js || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
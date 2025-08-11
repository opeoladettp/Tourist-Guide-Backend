# Tourist Hub API - Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Tourist Hub API to production environments. The API is designed to be deployed in containerized environments with proper security, monitoring, and scalability considerations.

## Prerequisites

### System Requirements

- **Node.js**: Version 18.x or higher
- **PostgreSQL**: Version 13.x or higher
- **Redis**: Version 6.x or higher (optional, for caching)
- **Memory**: Minimum 2GB RAM, recommended 4GB+
- **Storage**: Minimum 10GB available space
- **Network**: HTTPS/TLS termination capability

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-at-least-32-characters
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TRUST_PROXY=true

# Security Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FORCE_HTTPS=true
CSP_REPORT_URI=https://yourdomain.com/csp-report

# File Storage (AWS S3)
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Email Configuration (Optional)
EMAIL_ENABLED=true
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
EMAIL_FROM=Tourist Hub <noreply@yourdomain.com>

# Monitoring Configuration
APM_ENABLED=true
APM_SERVER_URL=https://your-apm-server.com
LOG_LEVEL=info
CONSOLE_LOGGING=false

# Cache Configuration (Optional)
REDIS_ENABLED=true
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Feature Flags
API_DOCS_ENABLED=false
JOBS_ENABLED=true
```

## Deployment Methods

### 1. Docker Deployment (Recommended)

#### Dockerfile

```dockerfile
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY prisma/ ./prisma/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/tourist_hub
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    depends_on:
      - db
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    networks:
      - app-network

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=tourist_hub
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

### 2. Kubernetes Deployment

#### Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tourist-hub-api
  labels:
    app: tourist-hub-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tourist-hub-api
  template:
    metadata:
      labels:
        app: tourist-hub-api
    spec:
      containers:
      - name: api
        image: tourist-hub-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: tourist-hub-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: tourist-hub-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: tourist-hub-api-service
spec:
  selector:
    app: tourist-hub-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### 3. Traditional Server Deployment

#### Using PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'tourist-hub-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Start the application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

## Database Setup

### 1. Database Migration

```bash
# Run database migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 2. Database Backup Strategy

```bash
# Create backup script
cat > backup-db.sh << EOF
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_tourist_hub_\$DATE.sql"

pg_dump \$DATABASE_URL > \$BACKUP_FILE
gzip \$BACKUP_FILE

# Upload to S3 (optional)
aws s3 cp \$BACKUP_FILE.gz s3://your-backup-bucket/database/

# Keep only last 7 days of backups
find . -name "backup_tourist_hub_*.sql.gz" -mtime +7 -delete
EOF

chmod +x backup-db.sh

# Add to crontab for daily backups
echo "0 2 * * * /path/to/backup-db.sh" | crontab -
```

## Reverse Proxy Configuration

### Nginx Configuration

```nginx
upstream tourist_hub_api {
    server 127.0.0.1:3000;
    # Add more servers for load balancing
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=1r/s;

    # General API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://tourist_hub_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Authentication endpoints (stricter rate limiting)
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://tourist_hub_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://tourist_hub_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # Static files (if any)
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri $uri/ =404;
    }

    # Logging
    access_log /var/log/nginx/tourist_hub_access.log;
    error_log /var/log/nginx/tourist_hub_error.log;
}
```

## Monitoring and Logging

### 1. Application Monitoring

```bash
# Install monitoring tools
npm install -g clinic
npm install -g autocannon

# Performance profiling
clinic doctor -- node dist/server.js
clinic bubbleprof -- node dist/server.js
clinic flame -- node dist/server.js

# Load testing
autocannon -c 10 -d 30 http://localhost:3000/api/health
```

### 2. Log Management

```bash
# Setup log rotation
cat > /etc/logrotate.d/tourist-hub-api << EOF
/path/to/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nodejs nodejs
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### 3. Health Monitoring Script

```bash
#!/bin/bash
# health-monitor.sh

API_URL="https://yourdomain.com"
SLACK_WEBHOOK="your-slack-webhook-url"

check_health() {
    local endpoint=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")
    
    if [ "$response" != "200" ]; then
        send_alert "Health check failed for $endpoint (HTTP $response)"
        return 1
    fi
    return 0
}

send_alert() {
    local message=$1
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 Tourist Hub API Alert: $message\"}" \
        "$SLACK_WEBHOOK"
}

# Check various endpoints
check_health "/health"
check_health "/health/db"
check_health "/health/ready"

# Check response time
response_time=$(curl -o /dev/null -s -w "%{time_total}" "$API_URL/health")
if (( $(echo "$response_time > 2.0" | bc -l) )); then
    send_alert "High response time detected: ${response_time}s"
fi
```

## Security Checklist

### Pre-Deployment Security Checklist

- [ ] All environment variables are properly set
- [ ] JWT secrets are strong (32+ characters)
- [ ] Database connections use SSL
- [ ] HTTPS is enforced
- [ ] Security headers are configured
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] File upload restrictions are in place
- [ ] Input validation is implemented
- [ ] Error messages don't expose sensitive information
- [ ] Logging doesn't include sensitive data
- [ ] Dependencies are up to date
- [ ] Security scanning has been performed

### Post-Deployment Security Tasks

- [ ] Monitor security logs
- [ ] Set up intrusion detection
- [ ] Configure automated security updates
- [ ] Implement backup and recovery procedures
- [ ] Set up monitoring and alerting
- [ ] Perform penetration testing
- [ ] Review and update security policies

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database connectivity
   psql $DATABASE_URL -c "SELECT 1;"
   
   # Check connection pool
   curl http://localhost:3000/health/db/pool
   ```

2. **Memory Issues**
   ```bash
   # Monitor memory usage
   curl http://localhost:3000/health/resources
   
   # Adjust Node.js memory limit
   node --max-old-space-size=2048 dist/server.js
   ```

3. **Performance Issues**
   ```bash
   # Check system metrics
   curl http://localhost:3000/health/metrics/system
   
   # Monitor slow requests
   curl http://localhost:3000/health/performance
   ```

### Log Analysis

```bash
# Search for errors
grep -i error logs/combined.log | tail -20

# Monitor authentication failures
grep "AUTHENTICATION_FAILURE" logs/combined.log

# Check rate limiting
grep "RATE_LIMIT_EXCEEDED" logs/combined.log

# Monitor slow requests
grep "Slow Request Detected" logs/combined.log
```

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer Configuration**
   - Use sticky sessions for authentication
   - Implement health checks
   - Configure proper timeouts

2. **Database Scaling**
   - Read replicas for read-heavy workloads
   - Connection pooling
   - Query optimization

3. **Caching Strategy**
   - Redis for session storage
   - Application-level caching
   - CDN for static assets

### Vertical Scaling

1. **Resource Allocation**
   - Monitor CPU and memory usage
   - Adjust container limits
   - Optimize garbage collection

2. **Database Optimization**
   - Index optimization
   - Query performance tuning
   - Connection pool sizing

## Maintenance

### Regular Maintenance Tasks

1. **Daily**
   - Monitor health endpoints
   - Check error logs
   - Verify backup completion

2. **Weekly**
   - Review security logs
   - Update dependencies
   - Performance analysis

3. **Monthly**
   - Security audit
   - Capacity planning
   - Disaster recovery testing

### Update Procedures

1. **Application Updates**
   ```bash
   # Blue-green deployment
   pm2 start ecosystem.config.js --name tourist-hub-api-new
   # Test new version
   pm2 delete tourist-hub-api-old
   pm2 restart tourist-hub-api-new --name tourist-hub-api
   ```

2. **Database Updates**
   ```bash
   # Backup before migration
   ./backup-db.sh
   
   # Run migrations
   npx prisma migrate deploy
   ```

This deployment guide provides a comprehensive approach to deploying the Tourist Hub API in production environments with proper security, monitoring, and scalability considerations.
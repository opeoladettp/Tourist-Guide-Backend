# Vercel Deployment Guide for Tourist Hub API

## 🚀 Quick Deployment Steps

### 1. Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy to Vercel
```bash
vercel --prod
```

## 🔧 Environment Variables Setup

Before deploying, you need to configure these environment variables in your Vercel dashboard:

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-at-least-32-characters
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Server Configuration
NODE_ENV=production
PORT=3000

# AWS S3 Configuration (for file uploads)
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Security Configuration
ALLOWED_ORIGINS=https://your-frontend-domain.com
FORCE_HTTPS=true

# Optional: Email Configuration
EMAIL_ENABLED=true
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
EMAIL_FROM=Tourist Hub <noreply@yourdomain.com>
```

### Setting Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable with the appropriate value
5. Make sure to set them for "Production", "Preview", and "Development" environments

## 📁 Project Structure for Vercel

```
tourist-hub-api/
├── api/
│   └── index.ts          # Vercel serverless function entry point
├── src/
│   ├── app.ts           # Express app configuration
│   ├── server.ts        # Server setup (for local development)
│   └── ...              # All your API code
├── prisma/
│   └── schema.prisma    # Database schema
├── vercel.json          # Vercel configuration
├── .vercelignore        # Files to ignore during deployment
└── package.json         # Dependencies and scripts
```

## 🗄️ Database Setup

### Option 1: Use Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database → Postgres
3. Copy the connection string to your `DATABASE_URL` environment variable

### Option 2: External Database (Railway, PlanetScale, etc.)
1. Create a database on your preferred provider
2. Get the connection string
3. Add it as `DATABASE_URL` environment variable in Vercel

### Database Migration
After setting up the database, run migrations:
```bash
# If using Vercel Postgres
vercel env pull .env.local
npx prisma migrate deploy

# Or run migrations through Vercel CLI
vercel exec -- npx prisma migrate deploy
```

## 🔒 Security Considerations

1. **Environment Variables**: Never commit `.env` files. Use Vercel's environment variable system.

2. **CORS Configuration**: Update `ALLOWED_ORIGINS` to include your frontend domain.

3. **JWT Secrets**: Use strong, unique secrets for production.

4. **Database Security**: Ensure your database has proper access controls.

## 📊 Monitoring and Logs

### View Logs
```bash
vercel logs
```

### Monitor Performance
- Use Vercel Analytics for performance monitoring
- Check function execution times in Vercel dashboard
- Monitor database performance through your database provider

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compiles without errors
   - Verify Prisma schema is valid

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is correctly set
   - Check database is accessible from Vercel's regions
   - Ensure database accepts connections from Vercel IPs

3. **Function Timeout**
   - Vercel functions have a 30-second timeout (configured in vercel.json)
   - Optimize slow database queries
   - Consider using Vercel Pro for longer timeouts if needed

4. **Environment Variables Not Working**
   - Ensure variables are set for the correct environment (Production/Preview/Development)
   - Redeploy after adding new environment variables

### Debug Commands
```bash
# Check deployment status
vercel ls

# View function logs
vercel logs --follow

# Test locally with production environment
vercel dev
```

## 🎯 API Endpoints After Deployment

Your API will be available at: `https://your-project-name.vercel.app`

- Health Check: `https://your-project-name.vercel.app/health`
- API Base: `https://your-project-name.vercel.app/api`
- API Documentation: `https://your-project-name.vercel.app/api-docs`

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to your connected Git repository:

1. Connect your GitHub/GitLab repository to Vercel
2. Every push to main branch triggers a production deployment
3. Pull requests create preview deployments

## 📈 Performance Optimization

1. **Cold Starts**: Vercel functions may have cold starts. Consider using Vercel Pro for better performance.

2. **Database Connections**: Use connection pooling (already configured in the project).

3. **Caching**: Implement appropriate caching strategies for frequently accessed data.

4. **Bundle Size**: Keep dependencies minimal to reduce function size.

## 🎉 Post-Deployment Checklist

- [ ] All environment variables are set
- [ ] Database is connected and migrations are run
- [ ] Health check endpoint returns 200
- [ ] API documentation is accessible
- [ ] Authentication endpoints work
- [ ] File upload functionality works (if using S3)
- [ ] CORS is properly configured for your frontend
- [ ] Monitoring and logging are set up

Your Tourist Hub API is now ready for production on Vercel! 🚀
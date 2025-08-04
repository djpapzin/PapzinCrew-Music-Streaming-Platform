# Deployment Guide - Papzin & Crew

## 🚀 Deployment Overview

This guide covers various deployment strategies for the Papzin & Crew music streaming platform, from development to production environments.

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher (or yarn 1.22.x+)
- **Git**: Latest version
- **Modern browser**: Chrome 90+, Firefox 88+, Safari 14+

### Development Tools
- **Code Editor**: VS Code (recommended)
- **Terminal**: Command line access
- **Browser DevTools**: For debugging and testing

## 🏗️ Build Process

### Development Build
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access application
# http://localhost:5173
```

### Production Build
```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview

# Build output location: dist/
```

### Build Optimization
The production build includes:
- **Code splitting** for optimal loading
- **Tree shaking** to remove unused code
- **Asset optimization** (images, CSS, JS)
- **Minification** for smaller file sizes
- **Source maps** for debugging (optional)

## 🌐 Static Hosting Deployment

### Netlify Deployment

#### Method 1: Git Integration (Recommended)
1. **Connect Repository**
   ```bash
   # Push code to GitHub/GitLab/Bitbucket
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Netlify Configuration**
   - Login to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Select your repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
     - **Node version**: 18

3. **Environment Variables** (if needed)
   ```
   NODE_VERSION=18
   NPM_VERSION=9
   ```

#### Method 2: Manual Deploy
```bash
# Build the project
npm run build

# Install Netlify CLI
npm install -g netlify-cli

# Deploy to Netlify
netlify deploy --prod --dir=dist
```

#### Netlify Configuration File
Create `netlify.toml` in project root:
```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### Vercel Deployment

#### Method 1: Git Integration
1. **Connect Repository**
   - Login to [Vercel](https://vercel.com)
   - Import your Git repository
   - Configure project settings:
     - **Framework Preset**: Vite
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`

#### Method 2: Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

#### Vercel Configuration
Create `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### GitHub Pages Deployment

#### Using GitHub Actions
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

#### Manual GitHub Pages Setup
```bash
# Install gh-pages
npm install --save-dev gh-pages

# Add deploy script to package.json
"scripts": {
  "deploy": "gh-pages -d dist"
}

# Build and deploy
npm run build
npm run deploy
```

## 🐳 Docker Deployment

### Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine as build-stage

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine as production-stage

# Copy built assets
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration
Create `nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;
        
        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # Cache static assets
        location /assets/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
}
```

### Docker Commands
```bash
# Build Docker image
docker build -t papzin-crew-app .

# Run container
docker run -p 8080:80 papzin-crew-app

# Access application
# http://localhost:8080
```

### Docker Compose
Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
    
  # Optional: Add reverse proxy
  nginx-proxy:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./proxy.conf:/etc/nginx/nginx.conf
    depends_on:
      - app
```

## ☁️ Cloud Platform Deployment

### AWS S3 + CloudFront

#### S3 Setup
```bash
# Install AWS CLI
npm install -g aws-cli

# Configure AWS credentials
aws configure

# Create S3 bucket
aws s3 mb s3://papzin-crew-app

# Enable static website hosting
aws s3 website s3://papzin-crew-app \
  --index-document index.html \
  --error-document index.html

# Upload build files
aws s3 sync dist/ s3://papzin-crew-app --delete
```

#### CloudFront Distribution
```json
{
  "Origins": [{
    "DomainName": "papzin-crew-app.s3.amazonaws.com",
    "Id": "S3-papzin-crew-app",
    "S3OriginConfig": {
      "OriginAccessIdentity": ""
    }
  }],
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-papzin-crew-app",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true
  },
  "CustomErrorResponses": [{
    "ErrorCode": 404,
    "ResponseCode": 200,
    "ResponsePagePath": "/index.html"
  }]
}
```

### Google Cloud Platform

#### App Engine Deployment
Create `app.yaml`:
```yaml
runtime: nodejs18

handlers:
  - url: /assets
    static_dir: dist/assets
    secure: always
    
  - url: /.*
    static_files: dist/index.html
    upload: dist/index.html
    secure: always
```

Deploy command:
```bash
gcloud app deploy
```

## 🔧 Environment Configuration

### Environment Variables
Create `.env.production`:
```env
VITE_API_URL=https://api.papzincrew.com
VITE_CDN_URL=https://cdn.papzincrew.com
VITE_ANALYTICS_ID=GA_MEASUREMENT_ID
VITE_SENTRY_DSN=SENTRY_DSN_URL
```

### Build-time Configuration
Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/papzin-crew/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react']
  }
}));
```

## 📊 Performance Optimization

### Build Optimization
```bash
# Analyze bundle size
npm install -g webpack-bundle-analyzer
npx vite-bundle-analyzer

# Optimize images
npm install -g imagemin-cli
imagemin src/assets/images/* --out-dir=dist/assets/images
```

### CDN Configuration
```javascript
// Configure asset URLs for CDN
const assetUrl = (path) => {
  const baseUrl = import.meta.env.VITE_CDN_URL || '';
  return `${baseUrl}${path}`;
};
```

### Caching Strategy
```nginx
# Nginx caching configuration
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location ~* \.(html)$ {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

## 🔍 Monitoring and Analytics

### Error Tracking (Sentry)
```bash
# Install Sentry
npm install @sentry/react @sentry/tracing

# Configure in main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE
});
```

### Analytics (Google Analytics)
```typescript
// Install GA4
npm install gtag

// Configure tracking
import { gtag } from 'gtag';

gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID);
```

### Performance Monitoring
```javascript
// Web Vitals tracking
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be 18+
```

#### Routing Issues (404 on refresh)
Ensure your hosting platform redirects all routes to `index.html`:
```
/* /index.html 200
```

#### Asset Loading Issues
Check base URL configuration in `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/your-app-path/'  // Adjust for subdirectory deployment
});
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=vite:* npm run build

# Verbose build output
npm run build -- --debug
```

## 🔐 Security Considerations

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:; 
               media-src 'self' https:;">
```

### HTTPS Configuration
```nginx
# Force HTTPS redirect
server {
    listen 80;
    server_name papzincrew.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name papzincrew.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
}
```

## 📈 Scaling Considerations

### CDN Integration
- **Static Assets**: Serve from CDN for global performance
- **Audio Files**: Use specialized audio CDN for streaming
- **Images**: Optimize and serve from image CDN

### Load Balancing
```yaml
# Docker Swarm example
version: '3.8'
services:
  app:
    image: papzin-crew-app
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
```

### Database Considerations
- **Read Replicas**: For high-traffic scenarios
- **Caching Layer**: Redis for session and data caching
- **CDN**: For static content delivery

---

This deployment guide provides comprehensive instructions for deploying the Papzin & Crew music streaming platform across various hosting environments, from simple static hosting to complex cloud deployments.
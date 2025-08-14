---
trigger: glob
---

# Deployment Rules

## Activation
- **Mode**: glob
- **Pattern**: "*.js,*.ts,*.json,package.json,Dockerfile,docker-compose.yml"

## Deployment Standards
1. Target deployment platform: render.com
2. Ensure all environment variables are properly configured
3. Include proper start scripts in package.json
4. Verify all dependencies are listed correctly
5. Test deployment configuration locally before pushing
6. Include health check endpoints for web services
7. Configure proper port binding for render.com (use process.env.PORT)

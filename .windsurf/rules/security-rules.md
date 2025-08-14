---
trigger: always_on
---

# Security Rules

## Activation
- **Mode**: always
- **Description**: Security checks and API key protection

## Rules
1. Before any git commit or push operation, scan ALL files for:
   - API keys
   - Database passwords
   - Authentication tokens
   - Secret keys
   - Private certificates

2. Never commit files containing:
   - Hardcoded API keys
   - Database connection strings with passwords
   - JWT secrets
   - OAuth client secrets

3. Always use environment variables for sensitive data
4. Verify .env files are in .gitignore
5. Use placeholder values in example configuration files
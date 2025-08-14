---
trigger: always_on
---

# Windows Development Environment

## Activation
- **Mode**: always
- **Description**: Windows 10 specific development considerations

## Windows-Specific Rules
1. Use cross-platform path handling (path.join, path.resolve)
2. Ensure line endings compatibility (configure git autocrlf)
3. Use Node.js LTS version compatible with Windows 10
4. Test shell scripts with both PowerShell and Git Bash
5. Account for Windows file system case-insensitivity
6. Use Windows-compatible npm scripts

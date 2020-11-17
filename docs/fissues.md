# Frequent issues

## Table of Contents
- [Frequent issues](#frequent-issues)
  - [Table of Contents](#table-of-contents)
  - [Getting error 'Failed to connect' on mac](#getting-error-failed-to-connect-on-mac)
  - [Client build 'killed'](#client-build-killed)
  
## Getting error 'Failed to connect' on mac
Check if docker daemon is running - when using docker desktop app you need to start it prior running scripts.

## Client build 'killed'
Angular cli build step needs 4GB of RAM while by default local docker instance is limited to 2GB. Changing docker 
configuration seems to fix the issue.

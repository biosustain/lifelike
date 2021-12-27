## -------------------------------------------------------
## See usage by running `make help`
## -------------------------------------------------------

# Include Docker Compose Makefile
include ./docker/Makefile

githooks: ##@development Set up Git commit hooks for linting and code formatting
	git config --local core.hooksPath .githooks/

#!/bin/bash
# Common utils used in git-hook scripts

# Formatting
b=$(tput bold)
n=$(tput sgr0)
HEADER () {
  echo "${b}${1}${n}"
}

# Get staged files for a directory
# additionally might perform pattern matching on given files
# Usage:
#   getStaged
#   getStaged <directory>
#   getStaged <directory> <pattern>
# Example:
#   getStaged appserver '\.(py)$'
getStaged () {
  relative_dir=${1:-'.'}
  matching_pattern=${2:-''}
  if [[ -n $RUN_HOOK_FOR_ALL_FILES ]]; then
    cd "${relative_dir}" \
     && git ls-files --cached --modified --other --exclude-standard \
      | grep -E "${matching_pattern}" \
      | sed 's/.*/"&"/'
  else
    cd "${relative_dir}" \
     && git diff --diff-filter=d --cached --name-only --relative \
      | grep -E "${matching_pattern}" \
      | sed 's/.*/"&"/'
  fi
}

# Printout system information
environmentInfo () {
  echo "Shell: ${SHELL}"
  echo "Shell version: $($SHELL --version)"
  echo "OS:"
  cat /etc/os-release  2> /dev/null || systeminfo  2> /dev/null || sw_vers 2> /dev/null
  echo "Docker: $(docker --version)"
  echo "Docker compose: $(docker compose --version)"
}

# Provide debugging insight
debug () {
  environmentInfo
  set -xv && echo $-
}

run_prettier () {
  dir=${1:-'.'}
  staged_files=$(getStaged $dir '\.(css|html|js|json|jsx|md|sass|scss|ts|tsx|vue|yaml|yml)$')
  # shellcheck disable=SC2236
  if [[ -n $staged_files ]];
  then
    (
      echo "> Running prettier for $(echo "$staged_files" | wc -l) files..."
      echo ${staged_files} | xargs docker run --rm -v $(pwd)/$dir:/work \
        tmknom/prettier:2.8.7 --write --ignore-unknown \
        --cache --cache-strategy metadata --cache-location=.cache/.prettier-cache
    )
  else
    echo "> Skipping prettier run..."
  fi
}

run_black () {
  dir=${1:-'.'}
  staged_files=$(getStaged $dir '\.(py)$')
  # shellcheck disable=SC2236
  if [[ -n $staged_files ]];
  then
    (
    echo "> 🌽 Running black for $(echo "$staged_files" | wc -l) files..."
    echo ${staged_files} | \
      xargs docker run --rm \
      -v $(pwd)/$dir:/data --workdir /data \
      pyfound/black:23.3.0 \
      black --fast --color --skip-string-normalization
    )
  else
    echo "> Skipping black run..."
  fi
}

checkExitCode () {
  exit_code=$1
  if [ $exit_code != 0 ]; then
    echo "❌ Linting check has failed. You may use git commit --no-verify to skip."
    exit $exit_code
  fi
}

# Recurse hooks
#
# How it works
# This function will start at the ***ARANGO_USERNAME*** project directory and iterate over all
# directories, looking for the .githook directory. It will then execute
# the hook name passed by parameter if found.
#
# To use
# (1) Each directory might have a .githook directory
# (2) Each .githook directory might have an executable
# (3) Each .githook action should follow the naming conventions laid out by https://git-scm.com/docs/githooks
recurseHook () {
  hook_name=$1
  hook_dir=".githooks"

  #region Make utils available
  export -f HEADER
  export -f getStaged
  export -f debug
  #endregion

  for d in */; do
    code_path="./$d$hook_dir"
    if [[ -d $code_path ]] && [[ -f $code_path/$hook_name ]];
    then
      HEADER "🤖  Running hook ($hook_name) checks for $code_path"
      # Execute hook
      "$code_path/$hook_name"
      checkExitCode $?
    fi
  done
}

# Turn debugging on by the flag
if [[ -n $DEBUG_HOOKS ]];
then
  debug
fi

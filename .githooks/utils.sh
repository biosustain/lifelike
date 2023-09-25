#!/bin/bash
# Common utils used in git-hook scripts
cache_dir=".cache"

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
  prettier_cache_dir="$cache_dir/prettier"
  mkdir -p $prettier_cache_dir
  # shellcheck disable=SC2236
  if [[ -n $staged_files ]];
  then
    (
      echo "> Running prettier for $(echo "$staged_files" | wc -l) files..."
      branch_prettier_cache="$prettier_cache_dir/$(git rev-parse --abbrev-ref HEAD)"
      if [[ ! -f $branch_prettier_cache ]];
      then
        recent_cache=$(ls -Atr "$prettier_cache_dir" | tail -1)
        if [[ ! -z $recent_cache ]];
        then
          echo "> Reusing prettier cache from $recent_cache"
          cp "$prettier_cache_dir/$recent_cache" $branch_prettier_cache
        fi
      fi
      echo ${staged_files} | xargs docker run --rm -v $(pwd)/$dir:/work \
        tmknom/prettier:2.8.7 \
        --write \
        --ignore-unknown \
        --cache \
        --cache-strategy metadata \
        --cache-location=$branch_prettier_cache
    )
  else
    echo "> Skipping prettier run..."
  fi
}

run_black () {
  dir=${1:-'.'}
  staged_files=$(getStaged $dir '\.(py)$')
  black_cache_dir="$cache_dir/black"
  mkdir -p $black_cache_dir
  # shellcheck disable=SC2236
  if [[ -n $staged_files ]];
  then
    (
    echo "> 🌽 Running black for $(echo "$staged_files" | wc -l) files..."
    branch_black_cache_dir="$black_cache_dir/$(git rev-parse --abbrev-ref HEAD)"
    if [[ ! -d $branch_black_cache_dir ]];
    then
      recent_cache=$(ls -Atr "$black_cache_dir" | tail -1)
      if [[ ! -z $recent_cache ]];
      then
        echo "> Reusing black cache from $recent_cache"
        cp -r "$black_cache_dir/$recent_cache" $branch_black_cache_dir
      else
        mkdir -p $branch_black_cache_dir
      fi
    fi
    echo ${staged_files} | \
      xargs docker run --rm \
      -v $(pwd)/$branch_black_cache_dir:/***ARANGO_USERNAME***/.cache/black \
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

#!/usr/bin/env bash

# -----------------------------------------------------------------------------------------
# go-open.sh - Git Repository History Cleansing
# -----------------------------------------------------------------------------------------
# The purpose of this script is recreating Lifelike's original closed source code repository
# history, in a way that is free of copyrighted material and free of any potentially sensitive
# information that may be contained within the history, so that it is suitable for publishing
# as open source and continue ongoing development transparently in a single place
# without needing to truncate previous collaborators' commit history more than necessary.
# -----------------------------------------------------------------------------------------
#
#   Usage:
#     ./go-open.sh <source> <detination> [--help|-h]
#
#   <source>       Path or URL of source repository to read from.
#   <destination>  Path to a directory where the cleaned repository will be created.
#
# -----------------------------------------------------------------------------------------
#
#   The script will do the following:
#
#     1. Clone the <source> repository into <destination> directory. <source> is left untouched.
#
#     2. Use `git-filter-repo` tool to rewrite all repository history by removing all files
#        that are not currently being tracked in the HEAD commit. In other words, to remove
#        all traces of files that once existed, but were later removed.
#
#     3. Use `trufflehog` to search for any potential leaked secrets in the current repository
#        state, as well as across all its past commit history.
#
#     4. TODO: Insert Lifelike modified MIT license at the beginning of the repository history.
#

# Usage help message
usage="usage: $(basename "$0") SOURCE DESTINATION [-h|--help]"
# Print usage and ecit if -h or --help is specified
[[ $@ == *"-h"* || $@ == *"--help"* ]] && echo "$help" && exit 0

# Verify required tools are installed
if [ ! assert_available_commands "git git-filter-repo trufflehogl jq" ]; then
  echo "Not all required commands are available" && exit 1
fi

# -----------------------------------------------------------------------------------------
# Capture and validate input arguments
# -----------------------------------------------------------------------------------------
SOURCE=$1      # Source repository to be cleaned, can be a local path or a remote URL
DESTINATION=$2 # Destination directory where the cleaned repository will be created

if [[ -z $SOURCE || -z $DESTINATION ]]; then
  echo "ERROR: Missing argument(s)\n$usage" && exit 1
elif [ ! -d "$SOURCE/.git" ]; then
  echo "ERROR: SOURCE must be a path to a local Git repository" && exit 1
elif [ "$SOURCE" == "$DESTINATION" ]; then
  echo "ERROR: SOURCE and DESTINATION must not be the same" && exit 1
fi
# -----------------------------------------------------------------------------------------
# Verify required tools are installed
check_commands curl git git-filter-repo trufflehog || exit 1
# -----------------------------------------------------------------------------------------

function main() {

  divider "1. Checkout source repository"
  clone_source

  echo -e "\nRepository stats before compression:"
  print_git_stats

  divider "2. Compress repository history"
  [[ -z "$DRY_RUN" ]] && compress_history

  echo -e "\nRepository stats after compression:"
  print_git_stats

  divider "3. Check for secret leaks"
  detect_secrets
}

function check_commands() {
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "Command '$cmd' is not installed. Please install it."
      return 1
    fi
  done
}

function clone_source() {
  if [[ -d "$DESTINATION" && "$(ls -A "$DESTINATION")" ]]; then
    echo "⚡ Directory $DESTINATION already exists and is not empty."
    read -p "Do you really want to overwrite its contents? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 0
    fi
    rm -rf "$DESTINATION"
  fi
  echo "Cloning $SOURCE to $DESTINATION"
  git clone --no-local $SOURCE $DESTINATION
  cd $DESTINATION
}

function print_git_stats() {
  echo "Repository size: $(du -hs . | cut -f1)"
  echo "Commit count: $(git rev-list --count HEAD)"
}

function compress_history() {
  echo -e "I. First pass. Remove all files except the currently tracked ones..."
  git ls-files >.git/wanted-files.txt
  git filter-repo --force --paths-from-file .git/wanted-files.txt

  echo -e "\nII. Second pass. Remove all previously deleted files"
  git filter-repo --analyze
  ANALYSIS_PATH=.git/filter-repo/analysis
  tail +3 $ANALYSIS_PATH/path-deleted-sizes.txt |
    tr -s ' ' | cut -d ' ' -f 5- >$ANALYSIS_PATH/deleted-paths.txt
  git filter-repo --force --invert-paths --paths-from-file $ANALYSIS_PATH/deleted-paths.txt

  echo -e "\nIII. Cleanup"
  git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
  rm .git/wanted-files.txt
  rm -rf .git/filter-repo
}

function detect_secrets() {
  echo "Scanning repository with trufflehog..."
  report_file="$PWD/.git/detected-secrets.json"
  trufflehog git --json "file://$PWD" >$report_file
  secret_count="$(wc -l "$report_file" | awk '{print $1}')"
  if [[ ! $secret_count -ne 0 ]]; then
    echo "✅  No secrets found in the repository history."
  else
    echo "❌ Found $secret_count potential secrets in the repository."
    echo "Please review the report file: $report_file"

    # Detect and replace secrets with a placeholder
    $replacements_file="$PWD/.git/secret-replacements.txt"
    echo "" >"$replacements_file"
    while read -r line; do
      echo -n "$line" | jq -r ".Raw" | base64 -d >>"$replacements_file"
      echo -e "\n" >>"$replacements_file"
    done <"$report_file"

    # Remove duplicates
    sort -u "$replacements_file" >"$replacements_file.tmp" && mv "$replacements_file.tmp" "$replacements_file"

    echo "Replacing secrets with placeholder text..."
    git filter-repo --replace-text "$replacements_file" --force

    echo "Detecting secrets again"
    detect_secrets

    echo "TODO: Putting LICENSE in every commit..."
    #git filter-repo --force --commit-callback "if not commit.parents: commit.file_changes.append(FileChange(b'M', ., b'$(git hash-object -w LICENCE)', b'100644'))"
  fi
}

function divider() {
  [[ -z $1 ]] &&
    echo -e "\n===================================================================\n" ||
    echo -e "\n======= $1 ======================================="
}

# Execute main function
main

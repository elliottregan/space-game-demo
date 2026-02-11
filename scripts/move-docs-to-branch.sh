#!/bin/bash
#
# Move docs/ and MANUAL.md to a separate 'docs' branch.
# Run this before merging a PR to keep docs out of main.
#
# Usage: bun run move-docs
#
# This uses git plumbing commands to update the docs branch
# without switching branches or disrupting your working tree.
#
set -euo pipefail

DOCS_BRANCH="docs"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$CURRENT_BRANCH" = "$DOCS_BRANCH" ]; then
  echo "Error: Already on the '$DOCS_BRANCH' branch. Switch to your feature branch first."
  exit 1
fi

# Check for uncommitted changes to docs
if ! git diff --quiet -- docs/ MANUAL.md 2>/dev/null || ! git diff --cached --quiet -- docs/ MANUAL.md 2>/dev/null; then
  echo "Error: You have uncommitted changes in docs/ or MANUAL.md."
  echo "Please commit or stash them first."
  exit 1
fi

# Check if there are docs to move
DOCS_TREE=$(git rev-parse HEAD:docs 2>/dev/null || echo "")
MANUAL_BLOB=$(git rev-parse HEAD:MANUAL.md 2>/dev/null || echo "")

if [ -z "$DOCS_TREE" ] && [ -z "$MANUAL_BLOB" ]; then
  echo "No docs/ or MANUAL.md found on current branch. Nothing to move."
  exit 0
fi

echo "Moving docs from '$CURRENT_BRANCH' to '$DOCS_BRANCH' branch..."

# --- Step 1: Build a tree with only docs content ---

TREE_ENTRIES=""
if [ -n "$DOCS_TREE" ]; then
  TREE_ENTRIES="040000 tree $DOCS_TREE	docs"
fi
if [ -n "$MANUAL_BLOB" ]; then
  if [ -n "$TREE_ENTRIES" ]; then
    TREE_ENTRIES=$(printf '%s\n%s' "$TREE_ENTRIES" "100644 blob $MANUAL_BLOB	MANUAL.md")
  else
    TREE_ENTRIES="100644 blob $MANUAL_BLOB	MANUAL.md"
  fi
fi

NEW_TREE=$(echo "$TREE_ENTRIES" | git mktree)

# --- Step 2: Create a commit on the docs branch ---

COMMIT_MSG="Sync docs from $CURRENT_BRANCH

Source: $(git rev-parse --short HEAD) on $CURRENT_BRANCH"

if git rev-parse --verify "$DOCS_BRANCH" >/dev/null 2>&1; then
  PARENT_HASH=$(git rev-parse "$DOCS_BRANCH")
  # Skip if the tree hasn't changed
  EXISTING_TREE=$(git rev-parse "$DOCS_BRANCH^{tree}" 2>/dev/null || echo "")
  if [ "$NEW_TREE" = "$EXISTING_TREE" ]; then
    echo "Docs branch already up to date."
  else
    COMMIT=$(echo "$COMMIT_MSG" | git commit-tree "$NEW_TREE" -p "$PARENT_HASH")
    git update-ref "refs/heads/$DOCS_BRANCH" "$COMMIT"
    echo "Updated '$DOCS_BRANCH' branch."
  fi
else
  COMMIT=$(echo "Initial docs from $CURRENT_BRANCH" | git commit-tree "$NEW_TREE")
  git update-ref "refs/heads/$DOCS_BRANCH" "$COMMIT"
  echo "Created '$DOCS_BRANCH' branch."
fi

# --- Step 3: Remove docs from current branch ---

REMOVED=""
if [ -n "$DOCS_TREE" ] && [ -d "docs" ]; then
  git rm -rf --quiet docs/
  REMOVED="docs/"
fi
if [ -n "$MANUAL_BLOB" ] && [ -f "MANUAL.md" ]; then
  git rm -f --quiet MANUAL.md
  REMOVED="$REMOVED MANUAL.md"
fi

if [ -n "$REMOVED" ]; then
  git commit -m "chore: move docs to '$DOCS_BRANCH' branch

Docs and plans are maintained on the '$DOCS_BRANCH' branch.
To view: git switch $DOCS_BRANCH
To restore: git checkout $DOCS_BRANCH -- docs/ MANUAL.md"
  echo "Removed from '$CURRENT_BRANCH':$REMOVED"
fi

echo ""
echo "Done! Docs are now on the '$DOCS_BRANCH' branch."
echo ""
echo "  View docs:    git switch $DOCS_BRANCH"
echo "  Restore docs: git checkout $DOCS_BRANCH -- docs/ MANUAL.md"
echo "  Push docs:    git push origin $DOCS_BRANCH"

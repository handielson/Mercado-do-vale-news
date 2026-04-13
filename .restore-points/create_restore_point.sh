#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="$1"
RP_DIR="$2"
cd "$REPO_DIR"
echo "start=$(date -Is)" > "$RP_DIR/state.txt"
echo "branch=$(git rev-parse --abbrev-ref HEAD)" >> "$RP_DIR/state.txt"
echo "head=$(git rev-parse HEAD)" >> "$RP_DIR/state.txt"
git status > "$RP_DIR/git-status.txt"
git status --porcelain=v1 > "$RP_DIR/git-status-porcelain.txt"
git diff > "$RP_DIR/git-diff-unstaged.patch"
git diff --staged > "$RP_DIR/git-diff-staged.patch"
git archive --format=tar.gz -o "$RP_DIR/git-head.tar.gz" HEAD
tar -czf "$RP_DIR/worktree-current.tar.gz" --exclude='./.git' --exclude='./node_modules' --exclude='./.restore-points' --exclude='./dist' .
sha256sum "$RP_DIR/git-head.tar.gz" > "$RP_DIR/git-head.sha256"
sha256sum "$RP_DIR/worktree-current.tar.gz" > "$RP_DIR/worktree-current.sha256"
echo "done=$(date -Is)" >> "$RP_DIR/state.txt"
echo "OK:$RP_DIR" >> "$RP_DIR/state.txt"

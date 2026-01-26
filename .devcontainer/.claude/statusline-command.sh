#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Extract values
cwd=$(echo "$input" | jq -r '.workspace.current_dir')
model=$(echo "$input" | jq -r '.model.display_name')
output_style=$(echo "$input" | jq -r '.output_style.name')
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# Get git branch (skip optional locks)
if git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
  branch=$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null || echo "detached")
  git_info=" on \033[35m$branch\033[0m"
else
  git_info=""
fi

# Build status line
status=""

# Current directory
status+="\033[36m$cwd\033[0m"

# Git branch
status+="$git_info"

# Model and output style
status+=" | \033[33m$model\033[0m"
if [ -n "$output_style" ] && [ "$output_style" != "null" ]; then
  status+=" (\033[32m$output_style\033[0m)"
fi

# Context window remaining
if [ -n "$remaining" ] && [ "$remaining" != "null" ]; then
  remaining_int=${remaining%.*}
  if [ "$remaining_int" -lt 20 ]; then
    color="\033[31m" # red
  elif [ "$remaining_int" -lt 50 ]; then
    color="\033[33m" # yellow
  else
    color="\033[32m" # green
  fi
  status+=" | Context: ${color}${remaining_int}%\033[0m"
fi

# Output with printf to handle escape sequences
printf "%b\n" "$status"

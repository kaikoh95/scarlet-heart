#!/bin/bash

# Kill all tmux sessions that start with "slack-"

echo "Looking for tmux sessions starting with 'slack-'..."

# Get all tmux sessions
sessions=$(tmux list-sessions -F "#{session_name}" 2>/dev/null)

if [ -z "$sessions" ]; then
    echo "No tmux sessions found."
    exit 0
fi

# Filter and kill slack sessions
killed_count=0
while IFS= read -r session; do
    if [[ $session == slack-* ]]; then
        echo "Killing session: $session"
        tmux kill-session -t "$session"
        if [ $? -eq 0 ]; then
            ((killed_count++))
        else
            echo "  Failed to kill session: $session"
        fi
    fi
done <<< "$sessions"

if [ $killed_count -eq 0 ]; then
    echo "No slack sessions found to kill."
else
    echo "Successfully killed $killed_count slack session(s)."
fi

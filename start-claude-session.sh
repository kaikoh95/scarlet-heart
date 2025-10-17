#!/bin/bash

SESSION="claude-session"
PROJECT_DIR="/home/kai/Documents/dev/Claude-Code-Remote"

# Function to wait for a pattern in tmux pane output
wait_for_pattern() {
    local pane=$1
    local pattern=$2
    local timeout=${3:-30}  # Default 30 seconds timeout
    local elapsed=0

    echo "⏳ Waiting for: $pattern"

    while [ $elapsed -lt $timeout ]; do
        # Capture recent pane content (last 50 lines)
        local content=$(tmux capture-pane -t "$pane" -p -S -50 2>/dev/null)

        if echo "$content" | grep -q "$pattern"; then
            echo "✅ Found: $pattern"
            return 0
        fi

        sleep 1
        elapsed=$((elapsed + 1))
    done

    echo "⚠️ Timeout waiting for: $pattern"
    return 1
}

# Check if the session exists
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "🚀 Creating new session: $SESSION"

    # Create the session in detached mode
    tmux new-session -d -s "$SESSION"

    # Split the window to create 3 panes
    # Pane 0: left side (full height)
    # Pane 1: top-right
    # Pane 2: bottom-right
    tmux split-window -h -t "$SESSION"
    tmux split-window -v -t "$SESSION"

    echo "📱 Starting npm run telegram..."
    # Pane 2: npm run telegram (start first)
    tmux send-keys -t "$SESSION:0.2" "cd $PROJECT_DIR && npm run telegram" C-m
    wait_for_pattern "$SESSION:0.2" "started on port\|listening on port\|Server.*running" 60

    echo "🌐 Starting ngrok..."
    # Pane 1: ngrok (start second)
    tmux send-keys -t "$SESSION:0.1" "ngrok http --url=holy-bluegill-new.ngrok-free.app 3001" C-m
    wait_for_pattern "$SESSION:0.1" "started tunnel\|Forwarding\|Session Status.*online" 30

    echo "🤖 Starting Claude..."
    # Pane 0: Claude (start last)
    tmux send-keys -t "$SESSION:0.0" "claude --dangerously-skip-permissions" C-m

    echo "✅ All services started!"
else
    echo "🔄 Session exists, checking services..."

    # Session exists, ensure we have 3 panes
    PANE_COUNT=$(tmux list-panes -t "$SESSION" | wc -l)

    if [ "$PANE_COUNT" -lt 2 ]; then
        tmux split-window -h -t "$SESSION"
    fi
    if [ "$PANE_COUNT" -lt 3 ]; then
        tmux split-window -v -t "$SESSION"
    fi

    # Pane 2: Check if npm run telegram is running
    PANE2_PID=$(tmux list-panes -t "$SESSION:0.2" -F '#{pane_pid}' 2>/dev/null)
    if [ -n "$PANE2_PID" ] && ! pgrep -P "$PANE2_PID" -f "telegram" >/dev/null 2>&1; then
        echo "📱 Starting npm run telegram..."
        tmux send-keys -t "$SESSION:0.2" "cd $PROJECT_DIR && npm run telegram" C-m
        wait_for_pattern "$SESSION:0.2" "started on port\|listening on port\|Server.*running" 60
    else
        echo "✅ npm run telegram already running"
    fi

    # Pane 1: Check if ngrok is running
    PANE1_PID=$(tmux list-panes -t "$SESSION:0.1" -F '#{pane_pid}' 2>/dev/null)
    if [ -n "$PANE1_PID" ] && ! pgrep -P "$PANE1_PID" -f "ngrok" >/dev/null 2>&1; then
        echo "🌐 Starting ngrok..."
        tmux send-keys -t "$SESSION:0.1" "ngrok http --url=holy-bluegill-new.ngrok-free.app 3001" C-m
        wait_for_pattern "$SESSION:0.1" "started tunnel\|Forwarding\|Session Status.*online" 30
    else
        echo "✅ ngrok already running"
    fi

    # Pane 0: Check if Claude is running
    PANE0_PID=$(tmux list-panes -t "$SESSION:0.0" -F '#{pane_pid}' 2>/dev/null)
    if [ -n "$PANE0_PID" ] && ! pgrep -P "$PANE0_PID" -f "claude" >/dev/null 2>&1; then
        echo "🤖 Starting Claude..."
        tmux send-keys -t "$SESSION:0.0" "claude --dangerously-skip-permissions" C-m
    else
        echo "✅ Claude already running"
    fi

    echo "✅ All services checked!"
fi

echo ""
echo "📺 Attach to session with: scarlet -a"

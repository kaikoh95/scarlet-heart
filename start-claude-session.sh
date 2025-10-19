#!/bin/bash

# Claude Code Remote Session Manager
# Manages both Claude (Scarlet) and Webhook/Ngrok (Heart) sessions

CLAUDE_SESSION="claude-session"
WEBHOOK_SESSION="telegram-session"
PROJECT_DIR="/home/kai/Documents/dev/Claude-Code-Remote"
WORK_DIR="$PROJECT_DIR"

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

# Function to start Claude (Scarlet) session
start_scarlet() {
    local work_dir=${1:-$PROJECT_DIR}

    # Check if session already exists
    if tmux has-session -t "$CLAUDE_SESSION" 2>/dev/null; then
        echo "🔄 Session '$CLAUDE_SESSION' already exists"
        return 0
    fi

    echo "🚀 Creating new session: $CLAUDE_SESSION"

    # Create session with single pane for Claude
    tmux new-session -d -s "$CLAUDE_SESSION" -c "$work_dir"

    echo "🤖 Starting Claude in: $work_dir"
    tmux send-keys -t "$CLAUDE_SESSION:0.0" "cd \"$work_dir\" && claude --dangerously-skip-permissions" C-m

    echo "✅ Claude session started!"
}

# Function to start Webhook/Ngrok (Heart) session
start_heart() {
    # Check if session already exists
    if tmux has-session -t "$WEBHOOK_SESSION" 2>/dev/null; then
        echo "🔄 Session '$WEBHOOK_SESSION' already exists"
        return 0
    fi

    echo "🚀 Creating new session: $WEBHOOK_SESSION"

    # Create session with first pane for webhooks
    tmux new-session -d -s "$WEBHOOK_SESSION" -c "$PROJECT_DIR"

    echo "📱 Starting unified webhooks..."
    tmux send-keys -t "$WEBHOOK_SESSION:0.0" "cd $PROJECT_DIR && npm run webhooks:unified" C-m

    # Wait for webhooks to start
    echo "⏳ Waiting for webhook server to start..."
    local timeout=30
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        local captured=$(tmux capture-pane -t "$WEBHOOK_SESSION:0.0" -p -S -50 2>/dev/null)
        if echo "$captured" | grep -q -E "started on port|webhook server star|running on port|Unified webhook ser|Unified webhook server running"; then
            echo "✅ Webhook server started!"
            break
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    if [ $elapsed -ge $timeout ]; then
        echo "⚠️ Timeout waiting for webhook server"
    fi

    # Split window for ngrok at bottom
    echo "🌐 Starting ngrok..."
    tmux split-window -v -t "$WEBHOOK_SESSION" -c "$PROJECT_DIR"
    tmux send-keys -t "$WEBHOOK_SESSION:0.1" "ngrok http --url=holy-bluegill-new.ngrok-free.app 3001" C-m

    # Wait for ngrok
    elapsed=0
    timeout=30
    echo "⏳ Waiting for ngrok to start..."

    while [ $elapsed -lt $timeout ]; do
        if tmux capture-pane -t "$WEBHOOK_SESSION:0.1" -p -S -50 2>/dev/null | grep -q -E "started tunnel|Forwarding|Session Status.*online"; then
            echo "✅ ngrok started!"
            break
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    if [ $elapsed -ge $timeout ]; then
        echo "⚠️ Timeout waiting for ngrok"
    fi

    echo "✅ Webhook services started!"
}

# Function to kill sessions
kill_sessions() {
    local killed=0

    if tmux has-session -t "$WEBHOOK_SESSION" 2>/dev/null; then
        tmux kill-session -t "$WEBHOOK_SESSION" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "✅ Killed tmux session: $WEBHOOK_SESSION"
            killed=1
        fi
    fi

    if tmux has-session -t "$CLAUDE_SESSION" 2>/dev/null; then
        tmux kill-session -t "$CLAUDE_SESSION" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "✅ Killed tmux session: $CLAUDE_SESSION"
            killed=1
        fi
    fi

    if [ $killed -eq 0 ]; then
        echo "⚠️ No sessions to kill (may not exist)"
    fi
}

# Function to attach to Claude session
attach_scarlet() {
    if tmux has-session -t "$CLAUDE_SESSION" 2>/dev/null; then
        tmux attach -t "$CLAUDE_SESSION"
    else
        echo "❌ Failed to attach to session: $CLAUDE_SESSION (may not exist)"
        echo "💡 Try running '$0 --start' first to start the session"
        return 1
    fi
}

# Function to attach to Heart session
attach_heart() {
    if tmux has-session -t "$WEBHOOK_SESSION" 2>/dev/null; then
        tmux attach -t "$WEBHOOK_SESSION"
    else
        echo "❌ Failed to attach to session: $WEBHOOK_SESSION (may not exist)"
        echo "💡 Try running '$0 --start' first to start the session"
        return 1
    fi
}

# Function to show help
show_help() {
    cat << EOF
Claude Code Remote Session Manager

Usage: $(basename $0) [OPTIONS]

Options:
    --start, -s             Start both Heart and Scarlet sessions (default)
    --kill, -k              Kill both sessions
    --attach-scarlet, -as   Attach to Scarlet (Claude) session
    --attach-heart, -ah     Attach to Heart (Webhook/Ngrok) session
    --directory DIR, -d DIR Start Scarlet in specified directory
    --help, -h              Show this help message

Session Management:
    --scarlet-only          Start only Scarlet (Claude) session
    --heart-only            Start only Heart (Webhook/Ngrok) session

Examples:
    $(basename $0)                      # Start both sessions
    $(basename $0) --start              # Start both sessions
    $(basename $0) -d ~/myproject       # Start with custom directory
    $(basename $0) --attach-scarlet     # Attach to Claude session
    $(basename $0) --attach-heart       # Attach to Webhook session
    $(basename $0) --kill               # Kill all sessions
    $(basename $0) --scarlet-only       # Start only Claude
    $(basename $0) --heart-only         # Start only Webhooks

Sessions:
    - Scarlet: $CLAUDE_SESSION (Claude Code)
    - Heart: $WEBHOOK_SESSION (Webhooks + Ngrok)

EOF
}

# Parse command line arguments
ACTION="start"
START_HEART=true
START_SCARLET=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --start|-s)
            ACTION="start"
            shift
            ;;
        --kill|-k)
            ACTION="kill"
            shift
            ;;
        --attach-scarlet|-as)
            ACTION="attach-scarlet"
            shift
            ;;
        --attach-heart|-ah)
            ACTION="attach-heart"
            shift
            ;;
        --directory|-d)
            if [ -z "$2" ]; then
                echo "❌ Error: -d/--directory requires a directory path"
                echo "Usage: $0 -d <directory>"
                exit 1
            fi
            WORK_DIR="$2"
            shift 2
            ;;
        --scarlet-only)
            START_HEART=false
            ACTION="start"
            shift
            ;;
        --heart-only)
            START_SCARLET=false
            ACTION="start"
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
done

# Execute action
case $ACTION in
    start)
        if $START_HEART; then
            if tmux has-session -t "$WEBHOOK_SESSION" 2>/dev/null; then
                echo "  ✅ Heart already running"
            else
                echo "  🫀 Starting Heart...bedok bedok..."
                start_heart
                echo ""
            fi
        fi

        if $START_SCARLET; then
            if tmux has-session -t "$CLAUDE_SESSION" 2>/dev/null; then
                echo "  ✅ Scarlet already running"
            else
                echo "  🤖 Starting Scarlet...beep boop beep boop..."
                start_scarlet "$WORK_DIR"
            fi
        fi

        echo ""
        echo "  ╔════════════════════════════════════╗"
        echo "  ║  💖 ✅  READY!  ✅ 💖              ║"
        echo "  ╠════════════════════════════════════╣"
        echo "  ║  📺 Quick attach:                  ║"
        echo "  ║    • scarletheart -s  (Scarlet)    ║"
        echo "  ║    • scarletheart -h  (Heart)      ║"
        echo "  ╚════════════════════════════════════╝"
        echo ""
        ;;

    kill)
        echo "💔 Killing Scarlet Heart sessions..."
        echo ""
        kill_sessions
        echo ""
        echo "💔 Scarlet Heart stopped"
        echo ""
        ;;

    attach-scarlet)
        echo "📺 Attaching to Scarlet..."
        echo ""
        attach_scarlet
        ;;

    attach-heart)
        echo "📺 Attaching to Heart..."
        echo ""
        attach_heart
        ;;
esac

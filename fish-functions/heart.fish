function heart
    set -l session_name "telegram-session"
    set -l script_dir "/home/kai/Documents/dev/scarlet-heart"

    # Default action is start
    set -l action "start"

    # Parse arguments
    if test (count $argv) -gt 0
        switch $argv[1]
            case -k --kill
                set action "kill"
            case -s --start
                set action "start"
            case -a --attach
                set action "attach"
            case '*'
                echo "Unknown option: $argv[1]"
                echo "Usage: heart [-s|--start|-k|--kill|-a|--attach]"
                return 1
        end
    end

    # Execute action
    switch $action
        case start
            # Check if session already exists
            if tmux has-session -t $session_name 2>/dev/null
                echo "🔄 Session '$session_name' already exists"
                echo "📺 Attach with: heart -a"
                return 0
            end

            echo "🚀 Creating new session: $session_name"

            # Create session with first pane for telegram
            tmux new-session -d -s $session_name -c $script_dir

            echo "📱 Starting unified webhooks..."
            tmux send-keys -t "$session_name:0.0" "cd $script_dir && npm run webhooks:unified" C-m

            # Wait for telegram to start (check every second for 60 seconds)
            set -l timeout 30
            set -l elapsed 0
            echo "⏳ Waiting for Telegram webhook server to start..."

            while test $elapsed -lt $timeout
                set -l captured (tmux capture-pane -t "$session_name:0.0" -p -S -50 2>/dev/null)
                if echo "$captured" | grep -q -E "started on port|webhook server star|running on port|Unified webhook server running"
                    echo "✅ Telegram webhook server started!"
                    break
                end
                sleep 1
                set elapsed (math $elapsed + 1)
            end

            if test $elapsed -ge $timeout
                echo "⚠️ Timeout waiting for Telegram server"
            end

            # Split window for ngrok at bottom
            echo "🌐 Starting ngrok..."
            tmux split-window -v -t $session_name -c $script_dir
            tmux send-keys -t "$session_name:0.1" "ngrok http --url=holy-bluegill-new.ngrok-free.app 3001" C-m

            # Wait for ngrok
            set elapsed 0
            set timeout 30
            echo "⏳ Waiting for ngrok to start..."

            while test $elapsed -lt $timeout
                if tmux capture-pane -t "$session_name:0.1" -p -S -50 2>/dev/null | grep -q -E "started tunnel|Forwarding"
                    echo "✅ ngrok started!"
                    break
                end
                sleep 1
                set elapsed (math $elapsed + 1)
            end

            if test $elapsed -ge $timeout
                echo "⚠️ Timeout waiting for ngrok"
            end

            echo ""
            echo "✅ Telegram services started!"
            echo "📺 Attach to session with: heart -a"

        case kill
            tmux kill-session -t $session_name 2>/dev/null
            if test $status -eq 0
                echo "✅ Killed tmux session: $session_name"
            else
                echo "⚠️ Failed to kill session (may not exist): $session_name"
            end

        case attach
            tmux attach -t $session_name
            if test $status -ne 0
                echo "❌ Failed to attach to session: $session_name (may not exist)"
                echo "💡 Try running 'heart' first to start the session"
            end
    end
end

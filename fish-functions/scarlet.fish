function scarlet
    set -l session_name "claude-session"
    set -l script_dir "/home/kai/Documents/dev/Claude-Code-Remote"
    set -l work_dir $script_dir

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
            case -d --directory
                if test (count $argv) -lt 2
                    echo "❌ Error: -d/--directory requires a directory path"
                    echo "Usage: scarlet -d <directory>"
                    return 1
                end
                set work_dir $argv[2]
                set action "start"
            case '*'
                echo "Unknown option: $argv[1]"
                echo "Usage: scarlet [-s|--start|-k|--kill|-a|--attach|-d|--directory <path>]"
                return 1
        end
    end

    # Execute action
    switch $action
        case start
            # Check if session already exists
            if tmux has-session -t $session_name 2>/dev/null
                echo "🔄 Session '$session_name' already exists"
                echo "📺 Attach with: scarlet -a"
                return 0
            end

            echo "🚀 Creating new session: $session_name"

            # Create session with single pane for Claude
            tmux new-session -d -s $session_name -c $work_dir

            echo "🤖 Starting Claude in: $work_dir"
            tmux send-keys -t "$session_name:0.0" "cd \"$work_dir\" && claude --dangerously-skip-permissions" C-m

            echo ""
            echo "✅ Claude session started!"
            echo "📺 Attach to session with: scarlet -a"

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
                echo "💡 Try running 'scarlet' first to start the session"
            end
    end
end

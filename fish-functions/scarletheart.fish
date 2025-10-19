function scarletheart
    set -l telegram_session "telegram-session"
    set -l claude_session "claude-session"

    # Default action is start
    set -l action "start"
    set -l work_dir ""

    # Parse arguments
    if test (count $argv) -gt 0
        switch $argv[1]
            case --help
                set action "help"
            case -k --kill
                set action "kill"
            case --kill-slack
                set action "kill-slack"
            case -s
                set action "attach-scarlet"
            case -h
                set action "attach-heart"
            case -d --directory
                if test (count $argv) -lt 2
                    echo "❌ Error: -d/--directory requires a directory path"
                    echo "Usage: scarletheart -d <directory>"
                    return 1
                end
                set work_dir $argv[2]
                set action "start"
            case '*'
                echo "Unknown option: $argv[1]"
                echo "Usage: scarletheart [--help|-k|--kill|--kill-slack|-s|-h|-d|--directory <path>]"
                return 1
        end
    end

    # Show banner always
    echo ""
    echo -e "       \033[93m███████╗ ██████╗ █████╗ ██████╗ ██╗     ███████╗████████╗\033[0m"
    echo -e "       \033[93m██╔════╝██╔════╝██╔══██╗██╔══██╗██║     ██╔════╝╚══██╔══╝\033[0m"
    echo -e "       \033[93m███████╗██║     ███████║██████╔╝██║     █████╗     ██║   \033[0m"
    echo -e "       \033[93m╚════██║██║     ██╔══██║██╔══██╗██║     ██╔══╝     ██║   \033[0m"
    echo -e "       \033[93m███████║╚██████╗██║  ██║██║  ██║███████╗███████╗   ██║   \033[0m"
    echo -e "       \033[93m╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   \033[0m"
    echo ""
    echo -e "              \033[91m██╗  ██╗███████╗ █████╗ ██████╗ ████████╗\033[0m"
    echo -e "              \033[91m██║  ██║██╔════╝██╔══██╗██╔══██╗╚══██╔══╝\033[0m"
    echo -e "              \033[91m███████║█████╗  ███████║██████╔╝   ██║   \033[0m"
    echo -e "              \033[91m██╔══██║██╔══╝  ██╔══██║██╔══██╗   ██║   \033[0m"
    echo -e "              \033[91m██║  ██║███████╗██║  ██║██║  ██║   ██║   \033[0m"
    echo -e "              \033[91m╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   \033[0m"
    echo ""

    # Execute action
    switch $action
        case help
            echo "💖 Scarlet Heart - Claude Code Remote Management"
            echo ""
            echo "Usage: scarletheart [OPTION]"
            echo ""
            echo "Options:"
            echo "  (none)                Start both Heart and Scarlet sessions"
            echo "  -k, --kill            Kill both sessions"
            echo "  --kill-slack          Kill all Slack sessions"
            echo "  -s                    Attach to Scarlet (Claude) session"
            echo "  -h                    Attach to Heart (Telegram+ngrok) session"
            echo "  -d, --directory PATH  Start Scarlet in specified directory"
            echo "  --help                Show this help message"
            echo ""
            echo "Examples:"
            echo "  scarletheart                    # Start everything"
            echo "  scarletheart -s                 # Attach to Claude"
            echo "  scarletheart -h                 # Attach to Telegram/ngrok"
            echo "  scarletheart -d ~/myproject     # Start Claude in ~/myproject"
            echo "  scarletheart -k                 # Kill all sessions"
            echo "  scarletheart --kill-slack       # Kill all Slack sessions"
            echo ""
            return 0

        case kill
            echo "💔 Killing Scarlet Heart sessions..."
            echo ""

            heart -k
            scarlet -k

            echo ""
            echo "💔 Scarlet Heart stopped"
            echo ""

        case kill-slack
            echo "🔪 Killing all Slack sessions..."
            echo ""
            kill-slack-sessions
            echo ""
            echo "✅ Slack sessions terminated"
            echo ""

        case attach-scarlet
            echo "📺 Attaching to Scarlet..."
            echo ""
            scarlet -a

        case attach-heart
            echo "📺 Attaching to Heart..."
            echo ""
            heart -a

        case start
            # Check if telegram-session already exists
            if tmux has-session -t $telegram_session 2>/dev/null
                echo "  ✅ Heart already running"
            else
                echo "  🫀 Starting Heart...bedok bedok..."
                heart

                # Check if heart command succeeded
                if test $status -ne 0
                    echo "  ❌ Failed to start Heart"
                    return 1
                end
                echo ""
            end

            # Check if claude-session already exists
            if tmux has-session -t $claude_session 2>/dev/null
                echo "  ✅ Scarlet already running"
            else
                echo "  🤖 Starting Scarlet...beep boop beep boop..."
                if test -n "$work_dir"
                    scarlet -d "$work_dir"
                else
                    scarlet
                end

                # Check if scarlet command succeeded
                if test $status -ne 0
                    echo "  ❌ Failed to start Scarlet"
                    return 1
                end
            end

            echo ""
            echo "  ╔════════════════════════════════════╗"
            echo "  ║  💖 ✅  READY!  ✅ 💖              ║"
            echo "  ╠════════════════════════════════════╣"
            echo "  ║  📺 Quick attach:                  ║"
            echo "  ║    • scarletheart -s  (Scarlet)    ║"
            echo "  ║    • scarletheart -h  (Heart)      ║"
            echo "  ╚════════════════════════════════════╝"
            echo ""
    end
end

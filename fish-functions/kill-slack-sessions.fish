function kill-slack-sessions --description "Kill all tmux sessions starting with 'slack-'"
    set -l script_dir "/home/kai/Documents/dev/scarlet-heart"

    # Run the kill script
    bash "$script_dir/kill-slack-sessions.sh"
end

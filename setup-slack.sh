#!/bin/bash

# Claude Code Remote - Slack Quick Setup Script
# This script helps you quickly set up Slack notifications

echo "🚀 Claude Code Remote - Slack Setup"
echo "====================================="

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📋 Creating .env from template..."
    cp .env.example .env
else
    echo "✅ .env file already exists"
fi

# Get project directory
PROJECT_DIR=$(pwd)
echo "📁 Project directory: $PROJECT_DIR"

# Check if claude-hooks.json exists
if [ ! -f "claude-hooks.json" ]; then
    echo "📝 Creating claude-hooks.json..."
    cat > claude-hooks.json << EOF
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node $PROJECT_DIR/claude-hook-notify.js completed",
        "timeout": 5
      }]
    }],
    "SubagentStop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node $PROJECT_DIR/claude-hook-notify.js waiting",
        "timeout": 5
      }]
    }]
  }
}
EOF
    echo "✅ claude-hooks.json created"
else
    echo "✅ claude-hooks.json already exists"
fi

# Create data directory
mkdir -p src/data
echo "✅ Data directory ready"

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Create a Slack App:"
echo "   - Go to https://api.slack.com/apps"
echo "   - Click 'Create New App' → 'From scratch'"
echo "   - Name your app and select your workspace"
echo ""
echo "2. Configure OAuth & Permissions:"
echo "   - Navigate to 'OAuth & Permissions'"
echo "   - Add these Bot Token Scopes:"
echo "     • app_mentions:read (receive mentions in channels)"
echo "     • chat:write (send messages)"
echo "     • channels:history (read public channel threads)"
echo "     • groups:history (read private channel threads)"
echo "     • im:history (receive direct messages)"
echo "     • im:read (read direct message info)"
echo "   - Click 'Install to Workspace' and authorize"
echo "   - Copy the 'Bot User OAuth Token' (starts with xoxb-)"
echo ""
echo "3. Configure Event Subscriptions:"
echo "   - Navigate to 'Event Subscriptions'"
echo "   - Enable Events"
echo "   - Set Request URL to: https://your-domain.com/webhook/slack"
echo "   - Subscribe to bot events:"
echo "     • app_mention (for channel @mentions)"
echo "     • message.im (for direct messages)"
echo "   - Save changes and reinstall your app"
echo ""
echo "4. Edit .env and add your Slack credentials:"
echo "   - SLACK_ENABLED=true"
echo "   - SLACK_BOT_TOKEN (Bot User OAuth Token from step 2)"
echo "   - SLACK_SIGNING_SECRET (from Basic Information → App Credentials)"
echo ""
echo "5. (Optional) Set a default notification channel:"
echo "   - Open Slack, right-click on the channel"
echo "   - Select 'View channel details'"
echo "   - Scroll down and copy the Channel ID"
echo "   - Add to .env: SLACK_CHANNEL_ID=C1234567890"
echo "   - Note: Bot automatically remembers the channel where you use commands"
echo "   - This setting is only needed for first-time notifications"
echo ""
echo "6. Expose your webhook URL:"
echo "   Recommended - Using unified webhook server:"
echo "     npm run webhooks:unified"
echo "     ngrok http 3001"
echo ""
echo "   Alternative - Separate Slack server:"
echo "     npm run slack"
echo "     ngrok http 3002"
echo ""
echo "7. Start Claude with hooks in a terminal:"
echo "   export CLAUDE_HOOKS_CONFIG=$PROJECT_DIR/claude-hooks.json"
echo "   claude"
echo ""
echo "8. Test by running a task in Claude!"
echo ""
echo "For detailed instructions, see README.md"

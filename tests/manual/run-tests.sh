#!/bin/bash

# Manual Test Runner
# Helps run manual tests with proper context

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}   Manual Test Runner${NC}"
echo -e "${BLUE}==================================${NC}"
echo ""

# Check if .env exists
if [ ! -f "../../.env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create .env in project root first"
    exit 1
fi

# Menu
echo "Select test to run:"
echo ""
echo "1. Telegram Notification Test"
echo "2. Real Notification Test (with tmux session)"
echo "3. Long Email Content Test"
echo "4. Command Injection Test"
echo "5. Run all tests"
echo "0. Exit"
echo ""

read -p "Enter choice [0-5]: " choice

case $choice in
    1)
        echo -e "${GREEN}Running Telegram Notification Test...${NC}"
        node test-telegram-notification.js
        ;;
    2)
        echo -e "${YELLOW}Enter tmux session name (or press Enter for 'claude-real'):${NC}"
        read session_name
        session_name=${session_name:-claude-real}
        echo -e "${GREEN}Running Real Notification Test with session: $session_name${NC}"
        TMUX_SESSION=$session_name node test-real-notification.js
        ;;
    3)
        echo -e "${GREEN}Running Long Email Content Test...${NC}"
        node test-long-email.js
        ;;
    4)
        echo -e "${GREEN}Running Command Injection Test...${NC}"
        echo -e "${YELLOW}Note: Requires tmux session 'claude-hook-test' to be active${NC}"
        node test-injection.js
        ;;
    5)
        echo -e "${GREEN}Running all tests...${NC}"
        echo ""
        echo -e "${BLUE}[1/4] Telegram Notification Test${NC}"
        node test-telegram-notification.js
        echo ""
        echo -e "${BLUE}[2/4] Real Notification Test${NC}"
        TMUX_SESSION=claude-real node test-real-notification.js
        echo ""
        echo -e "${BLUE}[3/4] Long Email Content Test${NC}"
        node test-long-email.js
        echo ""
        echo -e "${BLUE}[4/4] Command Injection Test${NC}"
        node test-injection.js
        echo ""
        echo -e "${GREEN}✅ All tests completed${NC}"
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Test execution completed${NC}"

# Manual Testing Tools

This directory contains manual testing scripts for developing and debugging Claude Code Remote features.

## Available Tests

### 1. Telegram Notification Test
**File:** `test-telegram-notification.js`

Tests Telegram notification functionality with sample data.

**Usage:**
```bash
node tests/manual/test-telegram-notification.js
```

**Requirements:**
- TELEGRAM_BOT_TOKEN in .env
- TELEGRAM_CHAT_ID in .env

---

### 2. Real Notification Test
**File:** `test-real-notification.js`

Tests notifications with real tmux session names for command injection testing.

**Usage:**
```bash
TMUX_SESSION=your-session-name node tests/manual/test-real-notification.js
```

**Requirements:**
- TELEGRAM_BOT_TOKEN in .env
- TELEGRAM_CHAT_ID in .env
- Active tmux session

---

### 3. Long Email Content Test
**File:** `test-long-email.js`

Tests email templates with long Claude responses and code blocks.

**Usage:**
```bash
node tests/manual/test-long-email.js
```

**Requirements:**
- Email channel configured in config/channels.json
- SMTP credentials in .env

**What it tests:**
- Terminal-style email templates
- Long text formatting
- Code block rendering
- HTML escaping

---

### 4. Command Injection Test
**File:** `test-injection.js`

Tests command injection into tmux sessions.

**Usage:**
```bash
node tests/manual/test-injection.js
```

**Requirements:**
- Active tmux session named "claude-hook-test"
- ControllerInjector configured

**What it tests:**
- Listing available tmux sessions
- Injecting commands into specific sessions
- Command delivery verification

---

## Setup Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create `.env` file in project root with:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   # ... other credentials
   ```

3. **Run Tests:**
   ```bash
   # From project root
   node tests/manual/<test-file-name>.js
   ```

## Notes

- These are **manual tests** - they require human verification of results
- Tests send real notifications/emails - use with caution
- Some tests require active tmux sessions
- Check the console output for success/failure messages

## Development Tips

- Use these tests when developing new notification features
- Modify test data in each file to test edge cases
- Add new test files following the same pattern
- Keep tests simple and focused on one feature

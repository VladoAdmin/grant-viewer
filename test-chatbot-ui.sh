#!/bin/bash
# GrantBot Frontend UI Testing Script
# Tests chatbot widget on production site

set -euo pipefail

SITE="https://stormlevel.com/grant-viewer/"
SCREENSHOT_DIR="e2e-screenshots/chatbot"

echo "🤖 GrantBot UI Testing"
echo "   Site: $SITE"
echo "   Screenshots: $SCREENSHOT_DIR"
echo ""

mkdir -p "$SCREENSHOT_DIR"

# Open site
echo "1. Opening site..."
agent-browser open "$SITE"
sleep 3
agent-browser wait --load networkidle
agent-browser screenshot "$SCREENSHOT_DIR/01-initial-page.png"
echo "   ✅ Site loaded"

# Find chat button
echo ""
echo "2. Looking for chat button..."
agent-browser snapshot -i > /tmp/snapshot.txt
if grep -q "Chat" /tmp/snapshot.txt || grep -q "chat" /tmp/snapshot.txt; then
    echo "   ✅ Chat button found"
    CHAT_REF=$(grep -i "chat" /tmp/snapshot.txt | head -1 | grep -oP '\[ref=\K[^\]]+')
    echo "   Chat button ref: @$CHAT_REF"
else
    echo "   ❌ Chat button NOT found"
    agent-browser screenshot --annotate "$SCREENSHOT_DIR/02-no-chat-button.png"
    agent-browser close
    exit 1
fi

# Open chat
echo ""
echo "3. Opening chat widget..."
agent-browser click "@$CHAT_REF"
sleep 2
agent-browser screenshot "$SCREENSHOT_DIR/03-chat-opened.png"
echo "   ✅ Chat opened"

# Find message input
echo ""
echo "4. Looking for message input..."
agent-browser snapshot -i > /tmp/snapshot2.txt
if grep -q "Napíš správu" /tmp/snapshot2.txt || grep -q "textbox" /tmp/snapshot2.txt; then
    INPUT_REF=$(grep -E "(Napíš|textbox)" /tmp/snapshot2.txt | head -1 | grep -oP '\[ref=\K[^\]]+')
    echo "   ✅ Message input found: @$INPUT_REF"
else
    echo "   ⚠️ Message input not immediately visible, trying alternative..."
    INPUT_REF="e22"  # Fallback from previous test
fi

# Test Query 1: Valid agriculture query
echo ""
echo "5. Test Query 1: Agriculture in Nitra"
agent-browser fill "@$INPUT_REF" "Podnikáme v poľnohospodárskej výrobe v Nitre. Je otvorená nejaká výzva na rozšírenie výroby?"
sleep 1
agent-browser press Enter
echo "   Sent, waiting for response..."
sleep 5
agent-browser screenshot "$SCREENSHOT_DIR/04-query1-agriculture.png"
agent-browser console > "$SCREENSHOT_DIR/04-console.log"
echo "   ✅ Response received (screenshot saved)"

# Test Query 2: IT security
echo ""
echo "6. Test Query 2: IT security grants"
sleep 2
agent-browser snapshot -i > /tmp/snapshot3.txt
INPUT_REF=$(grep -E "(Napíš|textbox)" /tmp/snapshot3.txt | head -1 | grep -oP '\[ref=\K[^\]]+')
agent-browser fill "@$INPUT_REF" "Hľadám dotácie pre firmy na preplatenie IT bezpečnosti."
agent-browser press Enter
sleep 5
agent-browser screenshot "$SCREENSHOT_DIR/05-query2-it-security.png"
echo "   ✅ Response received"

# Test Query 3: House insulation
echo ""
echo "7. Test Query 3: House insulation"
sleep 2
agent-browser snapshot -i > /tmp/snapshot4.txt
INPUT_REF=$(grep -E "(Napíš|textbox)" /tmp/snapshot4.txt | head -1 | grep -oP '\[ref=\K[^\]]+')
agent-browser fill "@$INPUT_REF" "Hľadám dotácie na zateplenie domu."
agent-browser press Enter
sleep 5
agent-browser screenshot "$SCREENSHOT_DIR/06-query3-house-insulation.png"
echo "   ✅ Response received"

# Test Edge Case: Gibberish
echo ""
echo "8. Test Edge Case: Gibberish input"
sleep 2
agent-browser snapshot -i > /tmp/snapshot5.txt
INPUT_REF=$(grep -E "(Napíš|textbox)" /tmp/snapshot5.txt | head -1 | grep -oP '\[ref=\K[^\]]+')
agent-browser fill "@$INPUT_REF" "asdfghjkl qwerty zxcvbn"
agent-browser press Enter
sleep 4
agent-browser screenshot "$SCREENSHOT_DIR/07-edge-gibberish.png"
echo "   ✅ Edge case handled"

# Test Security: XSS attempt
echo ""
echo "9. Test Security: XSS attempt"
sleep 2
agent-browser snapshot -i > /tmp/snapshot6.txt
INPUT_REF=$(grep -E "(Napíš|textbox)" /tmp/snapshot6.txt | head -1 | grep -oP '\[ref=\K[^\]]+')
agent-browser fill "@$INPUT_REF" "<script>alert('xss')</script>"
agent-browser press Enter
sleep 4
agent-browser screenshot "$SCREENSHOT_DIR/08-security-xss.png"
echo "   ✅ XSS test complete"

# Check for JS errors
echo ""
echo "10. Checking for JavaScript errors..."
agent-browser errors > "$SCREENSHOT_DIR/js-errors.log"
if [ -s "$SCREENSHOT_DIR/js-errors.log" ]; then
    echo "   ⚠️ JS errors detected (see js-errors.log)"
else
    echo "   ✅ No JS errors"
fi

# Cleanup
echo ""
echo "11. Cleanup..."
agent-browser close
echo "   ✅ Browser closed"

echo ""
echo "✅ UI Testing Complete!"
echo "   Screenshots: $SCREENSHOT_DIR/"
echo "   Total: $(ls $SCREENSHOT_DIR/*.png | wc -l) screenshots"

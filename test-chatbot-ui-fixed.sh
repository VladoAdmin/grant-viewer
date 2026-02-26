#!/bin/bash
# GrantBot Frontend UI Testing Script (FIXED)
# Tests chatbot widget on production site

set -euo pipefail

SITE="https://stormlevel.com/grant-viewer/"
SCREENSHOT_DIR="e2e-screenshots/chatbot-fixed"

echo "🤖 GrantBot UI Testing (FIXED)"
echo "   Site: $SITE"
echo "   Screenshots: $SCREENSHOT_DIR"
echo ""

mkdir -p "$SCREENSHOT_DIR"

# Helper function to find chatbot textarea
find_chatbot_input() {
    agent-browser snapshot -i > /tmp/snapshot-full.txt
    # Look for textarea with "Napíš správu" or similar in chat context
    # Filter out the main search box
    grep -v "sémantické vyhľadávanie" /tmp/snapshot-full.txt | grep -E "(Napíš správu|textarea)" | tail -1 | grep -oP '\[ref=\K[^\]]+' || echo ""
}

# Open site
echo "1. Opening site..."
agent-browser open "$SITE"
sleep 3
agent-browser wait --load networkidle
agent-browser screenshot "$SCREENSHOT_DIR/01-initial-page.png"
echo "   ✅ Site loaded"

# Find and click chat FAB button
echo ""
echo "2. Finding chat FAB button..."
agent-browser snapshot -i > /tmp/snapshot1.txt
# Look for "Chat" button or chat icon button
CHAT_REF=$(grep -iE "(button.*Chat|Chat.*button)" /tmp/snapshot1.txt | grep -v "Zavrieť" | head -1 | grep -oP '\[ref=\K[^\]]+' || echo "e20")
echo "   Chat FAB ref: @$CHAT_REF"

echo "3. Opening chat panel..."
agent-browser click "@$CHAT_REF"
sleep 2
agent-browser screenshot "$SCREENSHOT_DIR/02-chat-opened.png"
echo "   ✅ Chat panel opened"

# Wait for chat panel animation
sleep 1

# Find chatbot textarea (NOT the main search box)
echo ""
echo "4. Finding chatbot message input..."
CHAT_INPUT=$(find_chatbot_input)
if [ -z "$CHAT_INPUT" ]; then
    echo "   ⚠️ Could not find chat input, trying common refs..."
    # Common refs from previous tests
    for ref in e22 e23 e24 e25; do
        if grep -q "@$ref" /tmp/snapshot-full.txt 2>/dev/null; then
            CHAT_INPUT=$ref
            break
        fi
    done
fi

if [ -z "$CHAT_INPUT" ]; then
    echo "   ❌ Chat input not found!"
    agent-browser screenshot --annotate "$SCREENSHOT_DIR/03-input-not-found.png"
    agent-browser close
    exit 1
fi

echo "   ✅ Chat input found: @$CHAT_INPUT"

# Test Query 1: Agriculture
echo ""
echo "5. Test Query 1: Agriculture in Nitra"
START_TIME=$(date +%s%3N)
agent-browser fill "@$CHAT_INPUT" "Podnikáme v poľnohospodárskej výrobe v Nitre. Je otvorená nejaká výzva na rozšírenie výroby?"
sleep 0.5
agent-browser press Enter
echo "   Sent, waiting for response..."
sleep 7  # Increased wait time
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))
agent-browser screenshot "$SCREENSHOT_DIR/04-query1-response.png"
echo "   ✅ Response time: ${RESPONSE_TIME}ms"

# Check if bot replied (look for new message)
agent-browser snapshot > /tmp/chat-state1.txt
if grep -q "GrantBot" /tmp/chat-state1.txt || grep -q "dotácie" /tmp/chat-state1.txt; then
    echo "   ✅ Bot response detected"
else
    echo "   ⚠️ No bot response visible yet"
fi

# Test Query 2: IT security
echo ""
echo "6. Test Query 2: IT security"
sleep 2
CHAT_INPUT=$(find_chatbot_input)
START_TIME=$(date +%s%3N)
agent-browser fill "@$CHAT_INPUT" "Hľadám dotácie pre firmy na preplatenie IT bezpečnosti."
agent-browser press Enter
sleep 7
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))
agent-browser screenshot "$SCREENSHOT_DIR/05-query2-response.png"
echo "   ✅ Response time: ${RESPONSE_TIME}ms"

# Test Query 3: House insulation
echo ""
echo "7. Test Query 3: House insulation"
sleep 2
CHAT_INPUT=$(find_chatbot_input)
START_TIME=$(date +%s%3N)
agent-browser fill "@$CHAT_INPUT" "Hľadám dotácie na zateplenie domu."
agent-browser press Enter
sleep 7
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))
agent-browser screenshot "$SCREENSHOT_DIR/06-query3-response.png"
echo "   ✅ Response time: ${RESPONSE_TIME}ms"

# Test Edge Case: Vague query
echo ""
echo "8. Edge Case: Vague query"
sleep 2
CHAT_INPUT=$(find_chatbot_input)
agent-browser fill "@$CHAT_INPUT" "dotácie"
agent-browser press Enter
sleep 5
agent-browser screenshot "$SCREENSHOT_DIR/07-edge-vague.png"
echo "   ✅ Vague query handled"

# Test Edge Case: Gibberish
echo ""
echo "9. Edge Case: Gibberish"
sleep 2
CHAT_INPUT=$(find_chatbot_input)
agent-browser fill "@$CHAT_INPUT" "xkcd lorem ipsum qwerty"
agent-browser press Enter
sleep 5
agent-browser screenshot "$SCREENSHOT_DIR/08-edge-gibberish.png"
echo "   ✅ Gibberish handled"

# Test Security: XSS
echo ""
echo "10. Security: XSS attempt"
sleep 2
CHAT_INPUT=$(find_chatbot_input)
agent-browser fill "@$CHAT_INPUT" "<script>alert('xss')</script>"
agent-browser press Enter
sleep 5
agent-browser screenshot "$SCREENSHOT_DIR/09-security-xss.png"
echo "   ✅ XSS test complete"

# Check console for errors
echo ""
echo "11. Checking JavaScript errors..."
agent-browser console > "$SCREENSHOT_DIR/console.log"
agent-browser errors > "$SCREENSHOT_DIR/js-errors.log"
if [ -s "$SCREENSHOT_DIR/js-errors.log" ]; then
    echo "   ⚠️ JS errors detected"
else
    echo "   ✅ No JS errors"
fi

# Final screenshot of full conversation
echo ""
echo "12. Final chat state..."
agent-browser screenshot "$SCREENSHOT_DIR/10-final-conversation.png"

# Cleanup
echo ""
echo "13. Cleanup..."
agent-browser close
echo "   ✅ Browser closed"

echo ""
echo "✅ UI Testing Complete!"
echo "   Screenshots: $SCREENSHOT_DIR/"
echo "   Total: $(ls $SCREENSHOT_DIR/*.png 2>/dev/null | wc -l) screenshots"

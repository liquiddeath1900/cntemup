# CNTEMUP — Always-On Mac Setup Guide

## What This Is
Your main MacBook (dev machine) and always-on MacBook (local server) share work via GitHub.
- **Main Mac**: Active dev sessions — coding, building, deploying
- **Always-On Mac**: 24/7 remote control via phone — research, content writing, SEO monitoring, background tasks
- **Bridge**: GitHub repo (push from main, pull from always-on)

---

## Step 1: Install Claude Code on Always-On Mac

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Launch and sign in with the $20 account
claude

# Enable remote control permanently
claude config set remote-control true
```

---

## Step 2: Clone the Repo

```bash
mkdir -p ~/Documents/CNTEMUP
cd ~/Documents/CNTEMUP
git clone https://github.com/liquiddeath1900/cntemup.git .
cd app
npm install
```

---

## Step 3: Copy CLAUDE.md to Always-On Mac

Copy the file `LOCAL-SERVER-CLAUDE.md` (included in this repo) to the always-on Mac:

```bash
# On the always-on Mac, place it at the repo root:
cp ~/Documents/CNTEMUP/app/LOCAL-SERVER-CLAUDE.md ~/CLAUDE.md
```

This gives Claude Code on the always-on Mac full project context.

---

## Step 4: Set Up MCP Servers

On the always-on Mac, run:

```bash
claude mcp add brave-search -- npx -y @anthropic-ai/brave-search-mcp-server
claude mcp add exa -- npx -y exa-mcp-server
claude mcp add firecrawl -- npx -y firecrawl-mcp
claude mcp add memory -- npx -y @anthropic-ai/memory-mcp-server
claude mcp add sequential -- npx -y @anthropic-ai/sequential-thinking-mcp-server
```

Then set the API keys:

```bash
# Create/edit ~/.claude.json or use claude mcp add with env vars
# These are your existing keys — enter them when prompted or add to config:

# Brave Search: YOUR_BRAVE_KEY_HERE
# Exa: YOUR_EXA_KEY_HERE
# Firecrawl: YOUR_FIRECRAWL_KEY_HERE
# Local Falcon: YOUR_LOCAL_FALCON_KEY_HERE
```

**Optional but recommended:**
```bash
claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest
# Token: YOUR_SUPABASE_TOKEN_HERE

claude mcp add local-falcon -- npx -y mcp-remote https://mcp.localfalcon.com/sse
# Token: YOUR_LOCAL_FALCON_KEY_HERE
```

---

## Step 5: Start Remote Control (24/7)

```bash
# Start a tmux session so it survives terminal close
tmux new -s cntemup

# Navigate to project
cd ~/Documents/CNTEMUP/app

# Start Claude Code with remote control
claude rc

# Detach from tmux (keeps it running):
# Press: Ctrl+B, then type :detach, press Enter
```

**To reattach later:**
```bash
tmux attach -t cntemup
```

---

## Step 6: Connect From Phone

1. Open **Claude app** on iPhone
2. Log in with the **same account** as the always-on Mac's Claude Code ($20 plan)
3. Tap **Code tab** on the left
4. You'll see the active `cntemup` session
5. Tap it → start typing commands

---

## Sync Workflow (The GitHub Bridge)

### After working on Main Mac:
```bash
# On main Mac (after a dev session):
git add -A && git commit -m "description" && git push
```

### Before working on Always-On Mac:
```bash
# Always-on Mac pulls latest (do this from phone via remote control):
git pull origin main
```

### If Always-On Mac creates content (new pages, research files):
```bash
# From phone, tell Claude on always-on Mac:
git add -A && git commit -m "description" && git push
```

Then on your main Mac next session:
```bash
git pull origin main
```

**Simple rule: Always push before switching machines. Always pull before starting work.**

---

## What Each Machine Does Best

| Task | Main Mac | Always-On Mac (Phone) |
|------|----------|----------------------|
| Active coding | ✅ | ❌ |
| Build & deploy | ✅ | ❌ |
| SEO research | ✅ | ✅ |
| Write content pages | ✅ | ✅ |
| Competitor monitoring | ❌ | ✅ |
| Site audits | ✅ | ✅ |
| Background research | ❌ | ✅ |
| Quick fixes from phone | ❌ | ✅ |

---

## Troubleshooting

**Session not showing on phone?**
- Make sure `claude rc` is running on the always-on Mac
- Check tmux: `tmux attach -t cntemup`
- Make sure you're logged into the same account on phone and always-on Mac

**Git conflicts?**
- Always pull before starting work on either machine
- If conflict: `git stash && git pull && git stash pop`

**MCP server not working?**
- Check: `claude mcp list`
- Reinstall: `claude mcp remove <name> && claude mcp add <name> ...`

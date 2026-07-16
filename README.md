<h1 align="center">◈ ClaudePad</h1>

<p align="center">
  A focused workspace for Claude Code sessions, terminals, ideas, tips, and multi-agent delivery.
</p>

<p align="center">
  <code>Sessions</code> · <code>Web Terminal</code> · <code>Ideas</code> · <code>Tips</code> · <code>Multi-Agent</code>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/yangjingo/ClaudePad/main/docs/assets/claudepad-hyrule-event.png" width="960" alt="ClaudePad Multi-Agent Hyrule workspace showing five agents responding to a software incident">
</p>

ClaudePad turns local and remote Claude Code work into one visual control surface. Monitor sessions, open a real xterm.js terminal, capture ideas, browse practical tips, or follow a software-delivery incident across an interactive Hyrule-inspired map.

## See it in action

### One compact workspace switcher

Sessions and Multi-Agent stay together as two workspace tabs, while Ideas and Tips remain available as lightweight utility actions.

<p align="center">
  <img src="https://raw.githubusercontent.com/yangjingo/ClaudePad/main/docs/assets/claudepad-workspaces.gif" width="800" alt="Animated demo switching between ClaudePad Sessions, Tips, and Multi-Agent workspaces">
</p>

### Explore the delivery map

Zoom, pan, recenter on the Sheikah Tower, use the minimap, and trigger a simulated incident without modifying live sessions.

<p align="center">
  <img src="https://raw.githubusercontent.com/yangjingo/ClaudePad/main/docs/assets/claudepad-map-controls.gif" width="800" alt="Animated demo of ClaudePad Hyrule map zoom, drag, recenter, and incident controls">
</p>

<table>
  <tr>
    <td width="50%"><img src="https://raw.githubusercontent.com/yangjingo/ClaudePad/main/docs/assets/claudepad-sessions.png" alt="ClaudePad session monitor"></td>
    <td width="50%"><img src="https://raw.githubusercontent.com/yangjingo/ClaudePad/main/docs/assets/claudepad-hyrule-map.png" alt="ClaudePad interactive Hyrule map centered on the Sheikah Tower"></td>
  </tr>
  <tr>
    <td align="center"><strong>Session operations</strong><br>Local and remote environments in one monitor.</td>
    <td align="center"><strong>Multi-agent expedition</strong><br>An open, draggable map with zoom and minimap navigation.</td>
  </tr>
</table>

## Features

- **Session Monitor** — inspect Claude Code sessions from `~/.claude/` and see active state at a glance.
- **Web Terminal** — interact with each session through xterm.js, WebSocket streaming, and node-pty.
- **Local + Remote Environments** — keep environment-aware configuration and independent version status together.
- **CC Ideas** — capture inspiration, search it, and track progress from new to archived.
- **CC Tips** — browse, search, randomize, and copy practical Claude Code shortcuts.
- **Session-linked Multi-Agent Hyrule** — hand a local or remote session to Link and four specialists through a six-stage delivery pipeline: requirements baseline, incident triage, parallel implementation, integration regression, release gate, and hardening retrospective.
- **Interactive World Map** — drag or use keyboard controls, zoom in and out, recenter, randomize the continent, and navigate through a minimap.

## Quick start

```bash
# Install globally
npm install -g @yangjingo/claudepad

# Run
claudepad

# Or run without installing
npx @yangjingo/claudepad
```

Open [http://localhost:8080](http://localhost:8080).

### Development

```bash
git clone https://github.com/yangjingo/ClaudePad.git
cd ClaudePad
npm install
npm run dev
```

## Navigation

| Area | Route | Purpose |
| --- | --- | --- |
| Sessions | `/` | View and manage local or remote Claude Code sessions |
| Ideas | `/idea.html` | Capture and track inspiration |
| Tips | `/tips.html` | Search and browse CC Tips |
| Multi-Agent | `/playground.html` | Explore the Hyrule delivery dashboard |

## Update

**v0.4.0** links Sessions to the interactive Multi-Agent Hyrule workspace, adds a draggable seeded continent with zoom and minimap navigation, and hardens static asset and dynamic session handling. See [CHANGELOG.md](./CHANGELOG.md) for the full history.

## Visual note

The Multi-Agent workspace is an original, unofficial fan-inspired interface. ClaudePad is not affiliated with or endorsed by Nintendo.

## License

MIT

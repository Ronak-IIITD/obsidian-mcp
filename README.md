# Obsidian MCP

MCP server for Obsidian that lets AI coding agents write, read, search, and organize your notes directly in your vault.

Published package: `@jod_panda/obsidian-mcp`

## Why this exists

When coding with AI, it is easy to ship fast but lose track of what changed, why it changed, and how the codebase evolved. This project is built to solve that.

Use this MCP server to make your agent keep a running project log in Obsidian while you build.

## From the creator

This project was built for one main purpose: take better notes while programming with AI.

Right now, many of us feel this pattern:

- We build software with AI quickly.
- Later, when we look back, the code feels hard to follow.
- We feel overwhelmed because we do not have a clean record of decisions and progress.

So I made this MCP server to track software progress clearly in Obsidian.

Vision:

- At project start, create a dedicated Obsidian note for that project.
- Tell your coding agent: after every completed task, write what happened into that note.
- The agent keeps outcomes and decisions in clear language.
- You stay in control of the codebase, even when AI writes most of it.

Pro tip:

- Avoid spaces in Obsidian folder and file names (paths are easier and less error-prone in terminal tooling).
- To get your vault path in Obsidian, right-click the vault label in the sidebar and copy the path.
- Paste that path as `VAULT_PATH` in your MCP client config.

You can also use this beyond software projects for personal insights, logs, and structured notes.

## Features

- `save_note`: create a note with frontmatter, tags, and project metadata
- `append_note`: append updates to an existing note
- `read_note`: read full note content
- `search_notes`: search by filename and content
- `list_notes`: list notes in the vault or a folder
- `delete_note`: delete note with explicit confirmation
- `daily_note`: append logs to today's daily note (auto-creates if missing)

## Requirements

- Node.js `>=18`
- An Obsidian vault path available on your machine

## Quick setup

Add this MCP server to your MCP client config:

```json
{
  "mcpServers": {
    "obsidian-mcp": {
      "command": "npx",
      "args": ["@jod_panda/obsidian-mcp"],
      "env": {
        "VAULT_PATH": "/home/ronak-anand/Documents/ObsidianVault"
      }
    }
  }
}
```

Then restart your MCP client.

## Recommended agent prompt pattern

Use a standing instruction like this in your coding workflow:

```text
At project start, create an Obsidian project note.
After every task you complete, append:
- what changed
- why it changed
- key files touched
- follow-up tasks or risks
```

This gives you a living changelog of AI-built software in plain language.

## Local development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Publish

If you are publishing updates to npm:

```bash
npm version patch
npm publish
```

Note: npm does not allow publishing over an existing version, so bump the version every release.

## Safety notes

- The server requires `VAULT_PATH` and exits if missing.
- Paths are resolved relative to the vault and blocked if outside it.
- `delete_note` requires explicit `confirm: true`.

## License

MIT

# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project intent

`@jod_panda/obsidian-mcp` is an MCP server that helps AI agents write structured project notes into Obsidian so humans can track progress and decisions while coding with AI.

## What to work on

- Improve MCP tool behavior and reliability
- Improve docs and examples
- Improve developer experience and code quality
- Keep changes focused and minimal

## Local commands

- Install: `npm install`
- Dev mode: `npm run dev`
- Build: `npm run build`
- Type check: `npm run lint`

## Coding rules

- Keep TypeScript strict and readable
- Preserve vault safety checks (never allow paths outside `VAULT_PATH`)
- Keep tool names and behavior stable unless change is intentional and documented
- Update `README.md` when user-facing behavior changes

## Contributor release policy

- Do not publish this package to npm from contributor environments
- Do not bump release versions unless explicitly requested by maintainer
- Open PRs; maintainer handles release/version/publish workflow

## Scope guardrails

- Do not add unrelated refactors
- Do not remove existing safety behavior without explicit rationale
- Do not change package name or registry settings

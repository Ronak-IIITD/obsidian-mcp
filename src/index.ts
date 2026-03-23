#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const VAULT_PATH = process.env.VAULT_PATH;
if (!VAULT_PATH) {
  console.error(
    "[obsidian-mcp] ERROR: VAULT_PATH environment variable is required.",
  );
  process.exit(1);
}
const vaultPath = path.resolve(VAULT_PATH);

function resolvePath(notePath: string): string {
  const resolved = path.resolve(vaultPath, notePath);
  if (!resolved.startsWith(vaultPath))
    throw new Error(`Path "${notePath}" is outside the vault.`);
  return resolved;
}

function ensureMd(filePath: string): string {
  return filePath.endsWith(".md") ? filePath : `${filePath}.md`;
}

function buildFrontmatter(tags: string[], project: string | undefined): string {
  const lines = ["---", `created: ${new Date().toISOString().split("T")[0]}`];
  if (project) lines.push(`project: "${project}"`);
  if (tags.length > 0) {
    lines.push("tags:");
    tags.forEach((t) => lines.push(`  - ${t.replace(/^#/, "")}`));
  }
  lines.push("---", "");
  return lines.join("\n");
}

async function listMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = (await fs.readdir(dir)) as string[];
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) results.push(...(await listMdFiles(full)));
    else if (stat.isFile() && entry.endsWith(".md")) results.push(full);
  }
  return results;
}

async function fileContains(filePath: string, query: string): Promise<boolean> {
  try {
    return (await fs.readFile(filePath, "utf-8"))
      .toLowerCase()
      .includes(query.toLowerCase());
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const server = new McpServer({ name: "obsidian-mcp", version: "1.0.0" });

server.tool(
  "save_note",
  "Create a new note in the Obsidian vault. Use when the user wants to save a learning, insight, decision, summary, or any content.",
  {
    title: z.string().describe("Title of the note (becomes the filename)"),
    content: z.string().describe("Markdown content of the note"),
    folder: z
      .string()
      .optional()
      .describe('Subfolder inside the vault, e.g. "Projects/MyApp"'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Tags, e.g. ["dev", "learning"]'),
    project: z.string().optional().describe("Project name for frontmatter"),
    overwrite: z
      .boolean()
      .optional()
      .describe("Overwrite if note exists. Defaults to false."),
  },
  async ({ title, content, folder, tags = [], project, overwrite = false }) => {
    const subdir = folder ? path.join(vaultPath, folder) : vaultPath;
    await fs.mkdir(subdir, { recursive: true });
    const filename = ensureMd(title.replace(/[/\\?%*:|"<>]/g, "-"));
    const fullPath = resolvePath(path.join(folder ?? "", filename));
    if ((await fileExists(fullPath)) && !overwrite) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Note "${filename}" already exists. Set overwrite: true to replace it, or use append_note to add to it.`,
          },
        ],
      };
    }
    await fs.writeFile(
      fullPath,
      buildFrontmatter(tags, project) + `# ${title}\n\n${content}\n`,
      "utf-8",
    );
    return {
      content: [
        {
          type: "text" as const,
          text: `✅ Note saved: ${path.relative(vaultPath, fullPath)}`,
        },
      ],
    };
  },
);

server.tool(
  "append_note",
  "Append content to an existing note in the vault. Great for adding new learnings to an ongoing project note.",
  {
    path: z
      .string()
      .describe('Relative path to the note, e.g. "Projects/MyApp.md"'),
    content: z.string().describe("Markdown content to append"),
    heading: z
      .string()
      .optional()
      .describe('Optional heading, e.g. "## 2026-03-17 Update"'),
  },
  async ({ path: notePath, content, heading }) => {
    const fullPath = resolvePath(ensureMd(notePath));
    if (!(await fileExists(fullPath))) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Note not found: "${notePath}". Use save_note to create it first.`,
          },
        ],
      };
    }
    const timestamp = new Date().toISOString().split("T")[0];
    const section = heading
      ? `\n\n${heading}\n\n${content}`
      : `\n\n---\n*Updated: ${timestamp}*\n\n${content}`;
    await fs.appendFile(fullPath, section, "utf-8");
    return {
      content: [
        {
          type: "text" as const,
          text: `✅ Appended to: ${path.relative(vaultPath, fullPath)}`,
        },
      ],
    };
  },
);

server.tool(
  "read_note",
  "Read the full content of a note from the Obsidian vault.",
  {
    path: z
      .string()
      .describe('Relative path to the note, e.g. "Projects/MyApp.md"'),
  },
  async ({ path: notePath }) => {
    const fullPath = resolvePath(ensureMd(notePath));
    try {
      return {
        content: [
          { type: "text" as const, text: await fs.readFile(fullPath, "utf-8") },
        ],
      };
    } catch {
      return {
        content: [
          { type: "text" as const, text: `Note not found: "${notePath}"` },
        ],
      };
    }
  },
);

server.tool(
  "search_notes",
  "Search for notes in the Obsidian vault by keyword. Searches both filenames and file content.",
  {
    query: z.string().describe("Search query"),
    folder: z
      .string()
      .optional()
      .describe('Limit search to a subfolder, e.g. "Projects"'),
    limit: z.number().optional().describe("Max results. Defaults to 10."),
  },
  async ({ query, folder, limit = 10 }) => {
    const searchRoot = folder ? path.join(vaultPath, folder) : vaultPath;
    const allFiles = await listMdFiles(searchRoot);
    const matches: string[] = [];
    for (const file of allFiles) {
      const relative = path.relative(vaultPath, file);
      if (
        relative.toLowerCase().includes(query.toLowerCase()) ||
        (await fileContains(file, query))
      ) {
        matches.push(relative);
        if (matches.length >= limit) break;
      }
    }
    const text =
      matches.length === 0
        ? `No notes found matching "${query}"`
        : `Found ${matches.length} note(s):\n\n${matches.map((m) => `- ${m}`).join("\n")}`;
    return { content: [{ type: "text" as const, text }] };
  },
);

server.tool(
  "list_notes",
  "List all notes in the vault or a specific folder.",
  {
    folder: z
      .string()
      .optional()
      .describe('Subfolder to list, e.g. "Projects". Defaults to vault root.'),
  },
  async ({ folder }) => {
    const searchRoot = folder ? path.join(vaultPath, folder) : vaultPath;
    const files = await listMdFiles(searchRoot);
    if (files.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: folder
              ? `No notes found in "${folder}"`
              : "Vault appears to be empty.",
          },
        ],
      };
    }
    const relative = files.map((f) => path.relative(vaultPath, f)).sort();
    return {
      content: [
        {
          type: "text" as const,
          text: `${relative.length} note(s):\n\n${relative.map((f) => `- ${f}`).join("\n")}`,
        },
      ],
    };
  },
);

server.tool(
  "delete_note",
  "Permanently delete a note from the vault. Requires explicit confirmation.",
  {
    path: z
      .string()
      .describe('Relative path to the note, e.g. "Projects/OldNote.md"'),
    confirm: z.boolean().describe("Must be true to confirm deletion."),
  },
  async ({ path: notePath, confirm }) => {
    if (!confirm)
      return {
        content: [
          {
            type: "text" as const,
            text: `Deletion cancelled. Set confirm: true to actually delete "${notePath}".`,
          },
        ],
      };
    const fullPath = resolvePath(ensureMd(notePath));
    try {
      await fs.unlink(fullPath);
      return {
        content: [{ type: "text" as const, text: `🗑️ Deleted: ${notePath}` }],
      };
    } catch {
      return {
        content: [
          { type: "text" as const, text: `Note not found: "${notePath}"` },
        ],
      };
    }
  },
);

server.tool(
  "daily_note",
  "Append content to today's daily note (creates it if missing). Great for logging project progress, quick thoughts, or build logs.",
  {
    content: z.string().describe("Content to log in today's daily note"),
    section: z
      .string()
      .optional()
      .describe('Section heading, e.g. "## OpenCode Session"'),
    folder: z
      .string()
      .optional()
      .describe('Folder for daily notes. Defaults to "Daily Notes".'),
  },
  async ({ content, section, folder = "Daily Notes" }) => {
    const today = new Date().toISOString().split("T")[0];
    const dailyFolder = path.join(vaultPath, folder);
    await fs.mkdir(dailyFolder, { recursive: true });
    const fullPath = path.join(dailyFolder, `${today}.md`);
    if (!(await fileExists(fullPath))) {
      await fs.writeFile(
        fullPath,
        buildFrontmatter(["daily"], undefined) + `# ${today}\n`,
        "utf-8",
      );
    }
    const heading = section ?? `## ${new Date().toLocaleTimeString()}`;
    await fs.appendFile(fullPath, `\n\n${heading}\n\n${content}\n`, "utf-8");
    return {
      content: [
        {
          type: "text" as const,
          text: `✅ Logged to daily note: ${path.relative(vaultPath, fullPath)}`,
        },
      ],
    };
  },
);

async function main() {
  try {
    await fs.access(vaultPath);
  } catch {
    console.error(
      `[obsidian-mcp] ERROR: Vault path does not exist: "${vaultPath}"`,
    );
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[obsidian-mcp] Running. Vault: ${vaultPath}`);
}

main().catch((err) => {
  console.error("[obsidian-mcp] Fatal error:", err);
  process.exit(1);
});


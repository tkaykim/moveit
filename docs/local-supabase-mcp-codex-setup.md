# Local Supabase MCP Setup for Codex

Date: 2026-06-17

## Goal

Codex should be able to reuse the same Supabase MCP setup that Claude Desktop already has, without copying the Supabase access token into additional files.

## Source of Truth

Claude Desktop config:

```text
C:\Users\tkay\AppData\Roaming\Claude\claude_desktop_config.json
```

Backup config:

```text
C:\Users\tkay\.claude\mcp-supabase-backup.json
```

The Moveit Supabase MCP server is:

```text
supabase-moveit
project-ref: vjxnollfggbufpqldxrb
```

The project `.env.local` Supabase URL points to the same ref.

## Codex Bridge

Codex now has a bridge script:

```text
C:\Users\tkay\.codex\scripts\supabase-mcp-from-claude.mjs
```

It reads Claude Desktop config at runtime, loads the named MCP server, and forwards stdio. The token remains in Claude's config and is not duplicated in Codex config.

Codex config now includes:

```toml
[mcp_servers.supabase-moveit]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\Users\tkay\.codex\scripts\supabase-mcp-from-claude.mjs', 'supabase-moveit']
startup_timeout_sec = 120
```

This should expose the Supabase MCP server in new Codex sessions after the Codex app reloads MCP config.

## Supabase CLI Bridge

Codex also has a CLI bridge:

```text
C:\Users\tkay\.codex\scripts\supabase-cli-from-claude.mjs
```

Usage:

```powershell
node "$env:USERPROFILE\.codex\scripts\supabase-cli-from-claude.mjs" --version
node "$env:USERPROFILE\.codex\scripts\supabase-cli-from-claude.mjs" branches list --project-ref vjxnollfggbufpqldxrb -o json
node "$env:USERPROFILE\.codex\scripts\supabase-cli-from-claude.mjs" projects list -o json
```

To use another Claude Supabase MCP token source:

```powershell
node "$env:USERPROFILE\.codex\scripts\supabase-cli-from-claude.mjs" --server=supabase-dancersbio projects list -o json
```

## Supabase Agent Skills

The official Supabase agent skills were installed into this project for Codex:

```text
.agents\skills\supabase
.agents\skills\supabase-postgres-best-practices
```

Important operating rules from those skills:

- Check current Supabase docs/changelog for Supabase implementation work.
- Prefer MCP `search_docs` for Supabase docs lookup when available.
- Use `list_tables`, `get_logs`, and `get_advisors` before risky schema/debugging work.
- Use `execute_sql` for iterative SQL; reserve `apply_migration` for deliberate migration-history writes.
- Review RLS, `SECURITY DEFINER`, `user_metadata`, `auth.role()`, and exposed-schema risks before auth/schema changes.

## Verified MCP Tools

The `supabase-moveit` MCP server starts successfully and exposes 20 tools:

- `search_docs`
- `list_tables`
- `list_extensions`
- `list_migrations`
- `apply_migration`
- `execute_sql`
- `get_logs`
- `get_advisors`
- `get_project_url`
- `get_publishable_keys`
- `generate_typescript_types`
- `list_edge_functions`
- `get_edge_function`
- `deploy_edge_function`
- `create_branch`
- `list_branches`
- `delete_branch`
- `merge_branch`
- `reset_branch`
- `rebase_branch`

Read-only verification completed:

- `list_tables` on `public` schema returned live Moveit tables.
- `branches list --project-ref vjxnollfggbufpqldxrb -o json` returned `[]`.

## Important Safety Notes

Vercel Production, Preview, and Development currently all point to the same Supabase project:

```text
vjxnollfggbufpqldxrb
```

This database contains live-looking data. Do not run mutating E2E flows against it unless the user explicitly asks and accepts the data impact.

For full mutating E2E, create a Supabase preview branch or separate test project first.

## Current Session Limitation

This Codex session was started before the new MCP server was added to `C:\Users\tkay\.codex\config.toml`, so the MCP server may not appear as a callable tool until a new Codex session or app reload.

Even in the current session, Codex can still use the same Supabase access by invoking the bridge scripts above.

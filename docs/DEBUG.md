# Debug Playbook

This manual test flow helps verify that the real Supabase backend and Zhipu AI
are wired correctly. Run through the steps after updating any environment
variables or schema.

## Pre-flight Checklist

- [.env] contains valid `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_ZHIPU_API_KEY`.
- Supabase Auth → Providers:
  - Email/Password enabled (confirmation optional).
  - Google enabled with GCP client ID/secret (optional, but required for Google
    button).
- Run `npm run dev` and keep browser console open (`Ctrl+Shift+I`).

## E2E Flow

1. **Login**
   - Use email/password form to register/log in.
   - Expected logs:
     - `[Moya][novels] Fetching novels ...`
     - `[Moya][auth] ...` (if provider errors occur).
   - If Google login fails with *provider not enabled*, enable it in Supabase
     dashboard.

2. **Create a Novel**
   - Input a title, click *新建*.
   - Console should show:
     - `[Moya][novels] Creating novel ...`
     - `[Moya][novels] Novel created { id: ... }`
   - Returning to the home screen must retain the new card.

3. **Create a Chapter**
   - Enter the novel, click *新建章节*.
   - Logs:
     - `[Moya][chapters] Creating chapter ...`
     - `[Moya][chapters] Chapter created { id: ... }`

4. **Auto-save**
   - Type some content; watch `[Moya][chapters] Auto-saving chapter ...`.
   - If errors occur, console will show `[Moya][chapters] Auto-save failed`.

5. **Sync Memory**
   - Click *同步记忆* in the editor toolbar.
   - Logs should include `[Moya][memory] Syncing chapter memory ...` and
     `[Moya][memory] Inserted memory fragments { count: ... }`.
   - Check Supabase `documents` table for new rows.

6. **AI Continuation**
   - Click *AI 续写*.
   - Success path:
     - `[Moya][ai] Starting AI continuation ...`
     - `[Moya][ai] Found related documents ...` (if memory exists)
   - Failure path surfaces alert + `[Moya][ai] AI generation failed ...`.

## Troubleshooting Tips

- If any step fails, copy the `[Moya][...]` log line and the accompanying
  payload when filing an issue.
- To reduce log noise in production, set `VITE_MOYA_DEBUG=false` in `.env`.


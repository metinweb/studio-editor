# Security policy

Studio Editor is currently a beta project. Security fixes are made on the latest `main` branch; older beta snapshots are not maintained separately.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/metinweb/studio-editor/security/advisories/new) to report suspected security problems privately. Include the affected commit or version, browser, reproduction steps and a minimal sample with no personal data.

If the private reporting form is unavailable, open an issue asking for a private contact channel without including vulnerability details. Please do not publish exploit instructions or credentials in a public issue.

## Scope

- HTML sanitization, editor iframe isolation and imports are relevant security boundaries.
- Documents and media in the standalone app are stored in the current browser profile and origin. Export backups before clearing browser data.
- Remote media URLs can contact their respective providers. YouTube and Vimeo playback loads those providers when requested.
- Servers under `examples/` demonstrate integration. Review authentication, authorization, storage limits, backups and deployment configuration before using them in production.

This policy does not promise an audit, a response time or a bug bounty.

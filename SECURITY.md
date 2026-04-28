# Security Policy

## Supported Versions

This project is pre-1.0. Security fixes are handled on the default development branch and released from the latest version.

## Reporting a Vulnerability

Please do not open a public issue for a security vulnerability.

Use GitHub private vulnerability reporting if it is available on the repository. If it is not available, open a minimal public issue asking for a private security contact without sharing sensitive details.

Do not include:

- Slack tokens
- Slack cookies
- workspace URLs
- private channel names
- user data
- local filesystem dumps
- screenshots containing private Slack content

## Scope

Security-sensitive areas include:

- local Slack Desktop token discovery
- cookie decryption
- workspace selection
- message target resolution
- anything that may send messages unintentionally
- tests or logs that could leak local Slack data

Expected behavior on unsupported platforms is graceful unavailable auth without reading desktop state.

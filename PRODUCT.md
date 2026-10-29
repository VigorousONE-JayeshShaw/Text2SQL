# Text-to-SQL Assistant

## Platform
web

## Purpose
Turn natural-language questions into reviewable SQL and run them against a local sample sales database. The user explicitly selected the sample sales database and required all work to stay in D:\NLP_CWS-Daksh.

## Implementation assumptions
Local single-user use; Node.js 24 with built-in SQLite; no external dependencies. The initial interface supports analysts learning or exploring SQL. Optional server-side OpenAI configuration expands translation beyond the documented offline examples. These implementation choices can be changed later.

## Constraints
Execution must be read-only, bounded and local. Sample data must be identified as sample data. API credentials stay on the server.

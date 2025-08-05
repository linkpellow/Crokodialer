# Integration Context INDEX

This folder contains all files required for AI agents (e.g., Cursor, Copilot, deepseek-coder-v2:latest) and developers to operate with complete project context, rules, and step-by-step guidance.

---

## 📖 File Guide

| File Name                           | Purpose / When to Use                                           |
|--------------------------------------|-----------------------------------------------------------------|
| Project_Overview.md                  | High-level project map, explains main modules and integration points. Start here for a birds-eye understanding of the system. |
| INTEGRATION_PLAN.md                  | File-by-file, step-by-step integration instructions for the dialer stack. Use this when planning, coding, or reviewing any integration or implementation task. |
| rules.yaml                           | AI-specific integration rules, naming conventions, and goals. Reference when refactoring, automating, or needing to check conventions and integration best practices. |
| Crokodial_(CRM)_Tree_Map.md          | Directory/file map for CRM/website codebase. Use for orientation and file lookup during CRM-side tasks. |
| Crokodialer_(Dialer)_Tree_Map.md     | Directory/file map for dialer codebase (integration focus). Essential for all dialer-side coding, refactoring, and integration work. |

---

## 🔖 Quick Reference

- **For architectural or module questions:** Start with `Project_Overview.md`.
- **For detailed implementation steps:** Use `INTEGRATION_PLAN.md` as your primary guide.
- **For AI agent rules, conventions, or automation:** Consult `rules.yaml`.
- **For directory/file lookup and codebase structure:**  
  Use `Crokodial_(CRM)_Tree_Map.md` for CRM/website, and `Crokodialer_(Dialer)_Tree_Map.md` for the dialer.

---

## 🧭 Navigation Tips

- Each file begins with a "Reference" comment explaining its main use case.
- If unsure which file to consult, re-read this README and ask the user if clarification is needed.
- Always keep this folder up to date. Add new context and integration files here as the project evolves.

---

# File-level Reference Comments

Below are suggested top-of-file reference comments for each file:

````markdown name=Project_Overview.md
<!--
Reference: Start here for a high-level overview of the Crokodial/GroupMe integration project.
Use this file to understand the module layout, main integration points, and system boundaries before deep dives.
For a full directory map, see Crokodial_(CRM)_Tree_Map.md and Crokodialer_(Dialer)_Tree_Map.md in this folder.
See INTEGRATION_PLAN.md for stepwise implementation, and rules.yaml for AI/automation protocol.
-->
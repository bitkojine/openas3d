# Contributing to OpenAs3D

Welcome! We love contributions, whether you're a human developer or an AI coding agent. This guide outlines the standards we use to maintain a high-quality codebase and automated release cycle.

---

## 🤖 Guide for AI Agents

If you are an AI assistant helping with this repository, please adhere to these strict requirements:

1.  **Context Loading**: Read `REPO_OVERVIEW.md` and `ARCHITECTURE.md` before making structural changes.
2.  **Atomic Changes**: Keep PRs focused. One feature or one bug fix per PR.
3.  **Conventional Commits**: You **MUST** use the Conventional Commits format for every commit. This is what powers our `semantic-release` automation.

---

## 📝 Commit Message Standard

We use [Conventional Commits](https://www.conventionalcommits.org/). This allows `semantic-release` to automatically determine version bumps and generate changelogs.

### Format
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types
-   **`feat`**: A new feature (triggers a **MINOR** release).
-   **`fix`**: A bug fix (triggers a **PATCH** release).
-   **`docs`**: Documentation only changes.
-   **`style`**: Changes that do not affect the meaning of the code (white-space, formatting, etc).
-   **`refactor`**: A code change that neither fixes a bug nor adds a feature.
-   **`perf`**: A code change that improves performance (triggers a **PATCH** release).
-   **`test`**: Adding missing tests or correcting existing tests.
-   **`build`**: Changes that affect the build system or external dependencies.
-   **`ci`**: Changes to our CI configuration files and scripts.
-   **`chore`**: Other changes that don't modify src or test files.

### Breaking Changes
To trigger a **MAJOR** release, include a `!` after the type/scope OR add `BREAKING CHANGE:` to the footer.

**Example:**
```text
feat(api)!: send an email to the customer when a product is shipped
```

---

## 🚀 Development Workflow

1.  **Branching**: Create a feature branch from `main` (e.g., `feat/new-cool-thing` or `fix/broken-laser`).
2.  **Local Development**: Follow the setup in `README.md`.
3.  **Testing**: Run `npm test` in the `vscode-extension` directory before committing.
4.  **Pull Requests**: 
    -   Ensure all CI checks pass (Build & Test).
    -   Keep descriptions concise. 
    -   **Important**: Use the "Squash and Merge" option on GitHub to maintain a clean history of conventional commits.

---

## 🏗️ Technical Stack

-   **Structure**: Project logic is in `vscode-extension/`.
-   **Language**: TypeScript.
-   **Visualization**: Three.js (rendered in a VS Code Webview).
-   **Layout**: Zone-based spatial organization.
-   **Automation**: GitHub Actions + `semantic-release`.

Thank you for helping build the future of spatial IDEs!

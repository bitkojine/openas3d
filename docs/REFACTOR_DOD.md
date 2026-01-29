# Definition of Done (DoD) for Refactors

To ensure technical debt is systematically reduced and not inadvertently increased, all refactoring Pull Requests (PRs) must adhere to the following Definition of Done criteria.

## 1. Metric Improvement
The primary goal of a refactor must be the reduction of technical debt.
- **Goal**: The targeted files or components **MUST** show a measurable reduction in technical debt (in minutes/hours) or complexity metrics (Cyclomatic or Cognitive Complexity) as reported by SonarQube.
- **Verification**: Compare the "Before" and "After" analysis in the SonarQube UI.

## 2. No Regressions
A refactor should not introduce new debt elsewhere.
- **Goal**: No new maintainability issues (code smells, vulnerabilities, or bugs) should be introduced in any part of the codebase.
- **Verification**: The PR analysis in SonarQube must report zero new issues of severity "Major" or higher.

## 3. Quality Gate Compliance
The refactor must meet the standards for new code.
- **Goal**: The SonarQube Quality Gate for "New Code" must pass.
- **Verification**: The GitHub Actions check `SonarQube Scan` must show a green status.

## 4. Explicit Debt Declaration
Each refactor PR must clearly state its purpose regarding technical debt.
- **Goal**: The PR description must explicitly list the SonarQube issue(s) or debt items it aims to resolve.
- **Format**: "This PR addresses tech debt item: [Issue ID or Description from SonarQube]"

## 5. Coverage Persistence
Refactoring should maintained or improve test coverage.
- **Goal**: Code coverage on the refactored lines must be at least equal to the previous state, and preferably higher.

---

*Note: Verification of these criteria is assisted by the automated SonarQube analysis integrated into the CI/CD pipeline.*

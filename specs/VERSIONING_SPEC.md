NOTICE: This specification was generated using AI. Place at the top of the file to indicate origin.

# Gemini Versioning Automation Spec

## Objective:
Implement automated semantic versioning for the VSCode extension project, following pre-launch and local-build guidelines. This spec defines the "why" and "what"; all "how" details (scripts, CI workflows, tagging, etc.) are for Gemini to implement automatically.

## Spec Details:

### 1. 1.0.0 Reservation
**What:**
- Version 1.0.0 is reserved for the official launch party.
- No automatic merge, CI, or local process should ever create or tag 1.0.0.
**Why:**
- Keeps the launch meaningful and ceremonial.
- Prevents accidental publication of a "stable" version before official launch.
- Ensures all pre-launch versions are clearly pre-1.0.

### 2. Starting Version After Reset
**What:**
- Reset all existing tags and release artifacts.
- Set the new baseline version to 0.2.0.
**Why:**
- Reflects early pre-alpha progress while leaving a clear starting point.
- Provides intuitive progression for automated patch and minor bumps.

### 3. Version Bumps on Main Merges
**What:**
- Default: patch bump for every merge to main.
- Minor bumps: triggered intentionally via PR label (e.g., "version:minor") or commit keywords.
- Major bumps: disabled until manual override for launch.
**Why:**
- Keeps main progressing with minimal manual effort.
- Maintains structured version history for pre-1.0 development.
- Prevents accidental major jumps before launch.

### 4. Local Build Versioning
**What:**
- Local builds append build metadata to canonical SemVer:
  Example: 0.2.1+local.173, 0.2.1+git.a1b2c3
**Why:**
- Tracks individual developer builds without altering main version history.
- Avoids conflicts between local builds and CI.
- Preserves SemVer ordering while providing build traceability.

### 5. GitHub Releases and Artifacts
**What:**
- Only intentional merges creating patch or minor bumps generate GitHub releases.
- Local or experimental builds do not create releases.
**Why:**
- Keeps release history clean and meaningful.
- Prevents clutter from dev/nightly builds.
- Ensures stakeholders see only testable, relevant versions.

## End of Spec

# Release Governance

## Version source

The `version` field in `package.json` is the single authoritative application version.

Release tags must use the form `v<package.version>`.

## Release identity

A release is identified by the immutable tuple:

`tag → commit SHA → package.json version`

`npm run release:metadata` emits the package name, authoritative version, checked-out commit SHA, and release tag when present.

## Release gate

`npm run release:check` validates that a supplied release tag exactly matches `v<package.version>` and, in CI, that `GITHUB_SHA` matches the checked-out commit.

The `Release Governance` workflow runs on future `v*` tag pushes and blocks the governance job when the relationship is inconsistent.

## Existing releases

`v0.8.0` is a historical release baseline. It must not be retagged or rewritten. The post-release governance changes in #139 start from the next development version.

## Procedure

1. Update `package.json` version to the intended new semantic version.
2. Run typecheck, tests, build, production smoke, and integration smoke.
3. Confirm `npm run release:metadata` reports the expected version and commit.
4. Create the corresponding immutable `v<version>` tag on the exact release commit.
5. Push the tag and require the Release Governance workflow to pass.

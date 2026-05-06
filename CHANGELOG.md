# Changelog

All notable changes to MockAPI are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.1.3] - 2026-04-27

### Fixed
- Duplicate folder entries in Move Route and New Route modals
- Recursive folder select supporting N-level depth
- Allow sub-folder creation at any nesting level

## [1.1.2] - 2026-04-27

### Fixed
- Recursive folder navigation for N-level depth
- Routes in sub-sub-folders not accessible in the UI
- Depth-based visual styling for nested folders

## [1.1.1] - 2026-04-26

### Fixed
- Response labels overwritten with empty string on save
- `callbacks` field injected at environment level unnecessarily
- `crudKey` and `callbacks` added on responses when not in original file

## [1.1.0] - 2026-04-26

### Added
- Version number displayed in header
- Changelog system via `src/version.js`

### Fixed
- Nested body property matching (`refundList.0.amount`)
- Extra JSON quotes around rule values
- Full body regex matching when modifier is empty
- HEAD method support
- CORS headers for OPTIONS preflight requests
- Regex operator with exact patterns (`^100$`, `^-100$`)

## [1.0.0] - 2026-04-24

### Added
- Initial release
- Native Mockoon JSON format support
- WSL file explorer
- Multi-response routes with rules engine
- Folder and subfolder navigation
- Monaco Editor for JSON body editing
- Auto-save on route edit, clone and delete
- HEAD and OPTIONS method support
- Nested body property matching
- Regex operator support
export const VERSION = "1.2.0";
export const CHANGELOG = [
  {
    version: "1.2.0",
    date: "2026-05-06",
    changes: [
      "Refactor: split MockAPI.jsx into separate components and utils",
      "Add src/constants/theme.js for colors and icons",
      "Add src/utils/mockoon.js for Mockoon format helpers",
      "Add src/utils/simulate.js for route simulation",
      "Add src/components/ui/ for atomic UI components",
      "Add src/components/ for feature components",
      "MockAPI.jsx reduced from 1608 to ~170 lines",
    ]
  },
  {
    version: "1.1.3",
    date: "2026-04-27",
    changes: [
      "Fix duplicate folder entries in move and create route modals",
      "Add recursive folder select supporting N-level depth",
      "Allow sub-folder creation at any nesting level",
    ]
  },
  {
    version: "1.1.2",
    date: "2026-04-27",
    changes: [
      "Fix recursive folder navigation for N-level depth",
      "Fix routes in sub-sub-folders not being accessible",
      "Add depth-based visual styling for nested folders",
    ]
  },
  {
    version: "1.1.1",
    date: "2026-04-26",
    changes: [
      "Fix response labels being overwritten with empty string on save",
      "Fix callbacks field injected at environment level unnecessarily",
      "Fix crudKey and callbacks added on responses when not in original file",
    ]
  },
  {
    version: "1.1.0",
    date: "2026-04-26",
    changes: [
      "Add version display in header",
      "Add changelog system",
    ]
  },
  {
    version: "1.0.0",
    date: "2026-04-26",
    changes: [
      "Initial release",
      "Native Mockoon JSON format support",
      "WSL file explorer",
      "Multi-response routes with rules engine",
      "Folder and subfolder navigation",
      "Monaco Editor for JSON body editing",
      "Auto-save on route edit, clone and delete",
      "HEAD and OPTIONS method support",
      "Nested body property matching",
      "Regex operator support",
    ]
  }
];
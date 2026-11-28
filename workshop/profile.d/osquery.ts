// `snshah osquery`: ask this machine questions in SQL and audit it against a
// small baseline. Not installed by default; it shows up where osquery already
// is (osqueryi on PATH, or the osqueryd service running) and is listed in
// `snshah profile catalog` everywhere else.
import type {
  CommandGroup,
  ProfileAbout,
  ProfileInstall,
  Selector,
} from "../snshah.ts";

export const selector = {
  kind: "any",
  of: [
    { kind: "has", command: "osqueryi" },
    { kind: "service", name: "osqueryd", state: "running" },
  ],
} satisfies Selector;

export const commands = {
  group: "osquery",
  summary:
    "Ask this machine questions in SQL and audit it against a small baseline (read-only)",
  effects: {
    status: "query",
    queries: "query",
    ask: "query",
    audit: "query",
    config: "advice",
  },
  activatesWhen: "osqueryi is on PATH or the osqueryd service is running",
  advice:
    "Install osquery (see `snshah profile catalog osquery`); snshah never installs it for you.",
  load: () => import("../ext/osquery.ts"),
} satisfies CommandGroup;

export const about = {
  title: "osquery",
  summary:
    "Ask this machine questions in SQL (what is listening, who can log in, what starts at boot) and audit it against a small baseline. Read-only, and the same on Linux, macOS and Windows.",
  use: 'Run `snshah osquery status`, then `snshah osquery audit` (it exits 1 on a serious finding). `snshah osquery queries` lists the named questions; `snshah osquery ask listening-ports` or `snshah osquery ask "SELECT name, version FROM os_version"` runs one.',
} satisfies ProfileAbout;

export const install = {
  packages: { winget: ["osquery.osquery"] },
  note: "osquery is not in the default Debian, Ubuntu or Fedora repositories: add osquery's own package repository or download the .deb or .rpm from osquery.io/downloads (the guide has the steps). macOS: brew install --cask osquery. Arch: the AUR.",
} satisfies ProfileInstall;

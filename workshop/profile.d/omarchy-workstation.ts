// An Omarchy workstation, for the Hyprland Lua configuration: an snshah entry
// in the Omarchy menu, a key binding that opens it, and a few web apps.
// Everything here is managed in marked blocks or files of its own and goes
// away with `snshah uninstall`. The default browser, work accounts and cloud
// folders are yours to choose: see the README for private profile.d examples.
import type {
  Hook,
  ProfileAbout,
  Recommendation,
  Selector,
} from "../snshah.ts";

export const selector = {
  kind: "all",
  of: [
    { kind: "omarchy" },
    { kind: "exists", path: "~/.config/hypr/hyprland.lua" },
  ],
} satisfies Selector;

const menuId = "snshah";
const inTerminal = (command: string) =>
  `omarchy-launch-terminal bash -lc '${command}; echo; read -rp "Press Enter to close " _'`;

const menu: Array<[string, { label: string; icon?: string; action?: string }]> =
  [
    [menuId, { label: "snshah", icon: "󰆍" }],
    [`${menuId}.status`, { label: "Status" }],
    [
      `${menuId}.status.doctor`,
      { label: "Doctor", action: inTerminal("snshah doctor") },
    ],
    [
      `${menuId}.status.plan`,
      { label: "Preview changes", action: inTerminal("snshah plan") },
    ],
    [
      `${menuId}.status.signin`,
      { label: "Who is signed in", action: inTerminal("snshah signin") },
    ],
    [`${menuId}.maintain`, { label: "Maintain" }],
    [
      `${menuId}.maintain.update`,
      { label: "Update snshah", action: inTerminal("snshah update") },
    ],
    [
      `${menuId}.maintain.apply`,
      { label: "Apply changes", action: inTerminal("snshah apply") },
    ],
  ];

const webApps = [
  { name: "Gmail", url: "https://mail.google.com/", icon: "mail-message-new" },
  { name: "WhatsApp", url: "https://web.whatsapp.com/", icon: "whatsapp" },
  {
    name: "Discord",
    url: "https://discord.com/channels/@me",
    icon: "omarchy-discord",
  },
] as const;

export const hooks = [
  {
    kind: "file",
    path: "~/.config/hypr/snshah.auto.lua",
    content: `o.bind("SUPER + ALT + M", "snshah", "omarchy menu summon ${menuId}")\n`,
  },
  {
    kind: "block",
    path: "~/.config/hypr/bindings.lua",
    comment: "--",
    content:
      'dofile((os.getenv("XDG_CONFIG_HOME") or os.getenv("HOME") .. "/.config") .. "/hypr/snshah.auto.lua")',
  },
  {
    kind: "block",
    path: "~/.config/omarchy/extensions/omarchy-menu.jsonc",
    comment: "//",
    within: "object",
    content: menu
      .map(([key, row]) => `  ${JSON.stringify(key)}: ${JSON.stringify(row)},`)
      .join("\n"),
  },
  ...webApps.map((app): Hook => ({
    kind: "command",
    phase: "after-apply",
    run: ["omarchy", "webapp", "install", app.name, app.url, app.icon, "", ""],
    unless: [
      "sh",
      "-c",
      `test -f "$HOME/.local/share/applications/${app.name}.desktop"`,
    ],
  })),
] satisfies Hook[];

export const recommends = [
  {
    tool: "rclone",
    why: "snshah efss mirrors OneDrive, SharePoint, Google Drive, Box and Dropbox without FUSE",
  },
  {
    tool: "age",
    why: "snshah vault keeps an encrypted backup of your private config",
  },
] satisfies Recommendation[];

export const about = {
  title: "Omarchy workstation",
  summary:
    "On an Omarchy machine with the Hyprland Lua configuration: an snshah entry in the Omarchy menu, a key binding that opens it, and Gmail, WhatsApp and Discord web apps.",
  use: "Press Super+Alt+M, or open the Omarchy menu and choose snshah, for Doctor, Preview changes, Who is signed in, Update and Apply. `snshah uninstall` removes everything it added.",
} satisfies ProfileAbout;

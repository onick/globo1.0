// Tracker models Globo knows how to configure: the Traccar protocol (and so the port the
// tracker must send to) and the SMS commands that point it at Globo. Ports are Traccar's
// defaults and must be published in docker-compose.yml.

export interface TrackerConfig {
  host: string | null; // public IP or domain of Globo's Traccar
  apn: string | null;
  apnUser: string | null;
  apnPassword: string | null;
}

export interface TrackerCommand {
  label: string;
  description: string;
  text: string;
  // Missing APN or server: the text has placeholders to fill in by hand
  incomplete: boolean;
}

export interface TrackerModel {
  id: string;
  name: string;
  protocol: string;
  port: number;
  // How the commands are sent, shown above them
  howTo: string;
  commands: (c: TrackerConfig, port: number) => TrackerCommand[];
}

const isIp = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

// A value for a command, or a visible placeholder when it isn't set yet
function fill(value: string | null, placeholder: string) {
  return value ? { text: value, missing: false } : { text: `<${placeholder}>`, missing: true };
}

function command(label: string, description: string, parts: (string | { text: string; missing: boolean })[]): TrackerCommand {
  return {
    label,
    description,
    text: parts.map((p) => (typeof p === "string" ? p : p.text)).join(""),
    incomplete: parts.some((p) => typeof p !== "string" && p.missing),
  };
}

// Concox GT06 family (GT06N, GT06E, WeTrack, …): commands end in #, no password
function concoxCommands(c: TrackerConfig, port: number): TrackerCommand[] {
  const apn = fill(c.apn, "APN");
  const host = fill(c.host, "SERVER");
  const credentials = c.apnUser ? `,${c.apnUser},${c.apnPassword ?? ""}` : "";
  return [
    command("APN", "Mobile data access of the SIM", ["APN,", apn, credentials, "#"]),
    command("Server", "Sends positions to Globo", ["SERVER,", c.host && !isIp(c.host) ? "1" : "0", ",", host, `,${port},0#`]),
    command("Data on", "Turns mobile data on", ["GPRSON,1#"]),
    command("Report interval", "Every 10 s while the engine is on, every 60 s when off", ["TIMER,10,60#"]),
    command("Check server settings", "Replies with the server and APN it has", ["GPRSSET#"]),
    command("Check location", "Replies with its current position", ["WHERE#"]),
    command("Restart", "Restarts the tracker so the changes apply", ["RESET#"]),
  ];
}

// Coban 303/TK103B: commands start with the password (123456 from the factory)
function cobanCommands(c: TrackerConfig, port: number): TrackerCommand[] {
  const commands = [
    command("APN", "Mobile data access of the SIM", ["apn123456 ", fill(c.apn, "APN")]),
    command("Server", "Sends positions to Globo", ["adminip123456 ", fill(c.host, "SERVER"), ` ${port}`]),
    command("Data mode", "Reports over mobile data instead of SMS", ["gprs123456"]),
    command("Report interval", "Every 30 s", ["fix030s***n123456"]),
    command("Check status", "Replies with its settings and signal", ["check123456"]),
  ];
  if (c.apnUser) {
    commands.splice(
      1,
      0,
      command("APN user", "Only if the carrier requires it", [`apnuser123456 ${c.apnUser}`]),
      command("APN password", "Only if the carrier requires it", [`apnpasswd123456 ${c.apnPassword ?? ""}`])
    );
  }
  return commands;
}

// Teltonika FMB: SMS start with two spaces (empty login and password)
function teltonikaCommands(c: TrackerConfig, port: number): TrackerCommand[] {
  return [
    command("APN and server", "One SMS sets the APN and sends positions to Globo over TCP", [
      "  setparam 2001:",
      fill(c.apn, "APN"),
      `;2002:${c.apnUser ?? ""};2003:${c.apnPassword ?? ""};2004:`,
      fill(c.host, "SERVER"),
      `;2005:${port};2006:0`,
    ]),
    command("Check location", "Replies with its current position", ["  getgps"]),
    command("Check status", "Replies with its connection status", ["  getstatus"]),
    command("Restart", "Restarts the tracker so the changes apply", ["  cpureset"]),
  ];
}

export const TRACKER_MODELS: TrackerModel[] = [
  {
    id: "concox-gt06n",
    name: "Concox GT06N",
    protocol: "gt06",
    port: 5023,
    howTo: "Send each command by SMS to the tracker's SIM number. It replies by SMS.",
    commands: concoxCommands,
  },
  {
    id: "concox-gt06e",
    name: "Concox GT06E",
    protocol: "gt06",
    port: 5023,
    howTo: "Send each command by SMS to the tracker's SIM number. It replies by SMS.",
    commands: concoxCommands,
  },
  {
    id: "concox-other",
    name: "Concox (other GT06 models: WeTrack, GT800, …)",
    protocol: "gt06",
    port: 5023,
    howTo: "Send each command by SMS to the tracker's SIM number. It replies by SMS.",
    commands: concoxCommands,
  },
  {
    id: "coban-303",
    name: "Coban 303F / TK103B",
    protocol: "gps103",
    port: 5001,
    howTo: "Send each command by SMS to the tracker's SIM number. 123456 is the factory password: use yours if it was changed.",
    commands: cobanCommands,
  },
  {
    id: "teltonika-fmb",
    name: "Teltonika FMB (FMB920, FMB120, …)",
    protocol: "teltonika",
    port: 5027,
    howTo: "Send the SMS to the tracker's SIM number, keeping the two spaces at the start.",
    commands: teltonikaCommands,
  },
  {
    id: "osmand",
    name: "Phone app (OsmAnd / Traccar Client)",
    protocol: "osmand",
    port: 5055,
    howTo: "In the app, set the server URL below and use the IMEI field as the device identifier. No SMS needed.",
    commands: (c, port) => [
      command("Server URL", "Paste it in the app's settings", ["http://", fill(c.host, "SERVER"), `:${port}`]),
    ],
  },
];

export function trackerModel(id: string | null | undefined): TrackerModel | null {
  return TRACKER_MODELS.find((m) => m.id === id) ?? null;
}

// What the tracker must send to: "1.2.3.4:5023 (TCP)"
export function serverAddress(model: TrackerModel, host: string | null): string | null {
  return host ? `${host}:${model.port} (TCP)` : null;
}

// IMEIs are 15 digits; some trackers (and the phone app) use other identifiers, as Traccar
// allows
export function validateImei(value: unknown): { imei: string } | { error: string } {
  const imei = typeof value === "string" ? value.trim() : "";
  if (!/^[0-9A-Za-z_-]{6,20}$/.test(imei)) {
    return { error: "The IMEI must be 6 to 20 letters, digits or dashes (15 digits for most trackers)" };
  }
  return { imei };
}

// Carriers in the Dominican Republic, for the SIM
export const SIM_CARRIERS = ["Claro", "Altice", "Viva", "Other"] as const;

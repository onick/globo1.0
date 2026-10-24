// Text of an alert notification. Recipients are fleet managers in the Dominican Republic,
// so messages are in Spanish and times in their time zone (ALERT_TIMEZONE).

export interface AlertMessageInput {
  type: "geofence_enter" | "geofence_exit" | "overspeed";
  time: Date;
  speedKmh: number;
  limitKmh: number | null;
  deviceName: string;
  vehiclePlate: string | null;
  geofenceName: string | null;
  mapUrl: string;
}

export interface AlertMessage {
  subject: string;
  text: string;
  // WhatsApp template body parameters, in order: {{1}} vehicle, {{2}} what happened,
  // {{3}} when, {{4}} map link
  whatsappParams: [string, string, string, string];
}

const DEFAULT_TIMEZONE = "America/Santo_Domingo";

export function buildAlertMessage(input: AlertMessageInput, timeZone = DEFAULT_TIMEZONE): AlertMessage {
  const vehicle = input.vehiclePlate ? `${input.deviceName} (${input.vehiclePlate})` : input.deviceName;
  const geofence = input.geofenceName ?? "una geocerca eliminada";
  const what =
    input.type === "geofence_enter"
      ? `entró en ${geofence}`
      : input.type === "geofence_exit"
        ? `salió de ${geofence}`
        : `iba a ${Math.round(input.speedKmh)} km/h (límite ${input.limitKmh} km/h)`;
  const when = new Intl.DateTimeFormat("es-DO", {
    timeZone,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(input.time);

  const subject =
    input.type === "overspeed"
      ? `Exceso de velocidad: ${vehicle}`
      : `${vehicle} ${input.type === "geofence_enter" ? "entró en" : "salió de"} ${geofence}`;

  return {
    subject,
    // The date goes on its own line: "p. m." already ends in a period
    text: `${vehicle} ${what}.\nFecha: ${when}\n\nVer en el mapa: ${input.mapUrl}\n\n— Globo GPS`,
    whatsappParams: [vehicle, what, when, input.mapUrl],
  };
}

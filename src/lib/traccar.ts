interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string;
}

interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  attributes: Record<string, unknown>;
  fixTime: string;
  serverTime: string;
}

class TraccarClient {
  private baseUrl: string;
  private cookie: string | null = null;

  constructor() {
    this.baseUrl = process.env.TRACCAR_API_URL || "http://localhost:8082/api";
  }

  private async authenticate(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        email: process.env.TRACCAR_ADMIN_EMAIL || "",
        password: process.env.TRACCAR_ADMIN_PASSWORD || "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Traccar auth failed: ${response.status}`);
    }

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!this.cookie) {
      await this.authenticate();
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Cookie: this.cookie || "",
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      this.cookie = null;
      await this.authenticate();
      return this.request<T>(path, options);
    }

    if (!response.ok) {
      throw new Error(`Traccar API error: ${response.status} ${path}`);
    }

    return response.json() as Promise<T>;
  }

  // Devices
  async getDevices(): Promise<TraccarDevice[]> {
    return this.request<TraccarDevice[]>("/devices");
  }

  async createDevice(name: string, uniqueId: string): Promise<TraccarDevice> {
    return this.request<TraccarDevice>("/devices", {
      method: "POST",
      body: JSON.stringify({ name, uniqueId }),
    });
  }

  async deleteDevice(id: number): Promise<void> {
    await this.request(`/devices/${id}`, { method: "DELETE" });
  }

  // Positions
  async getPositions(deviceId?: number): Promise<TraccarPosition[]> {
    const query = deviceId ? `?deviceId=${deviceId}` : "";
    return this.request<TraccarPosition[]>(`/positions${query}`);
  }

  // Route report (position history)
  async getRouteReport(
    deviceId: number,
    from: string,
    to: string
  ): Promise<TraccarPosition[]> {
    const params = new URLSearchParams({
      deviceId: String(deviceId),
      from,
      to,
    });
    return this.request<TraccarPosition[]>(`/reports/route?${params}`);
  }

  // WebSocket URL for real-time positions
  getWebSocketUrl(): string {
    return process.env.TRACCAR_WS_URL || "ws://localhost:8082/api/socket";
  }
}

// Singleton
const globalForTraccar = globalThis as unknown as {
  traccar: TraccarClient | undefined;
};

export const traccar =
  globalForTraccar.traccar ?? new TraccarClient();

if (process.env.NODE_ENV !== "production") {
  globalForTraccar.traccar = traccar;
}

export type { TraccarDevice, TraccarPosition };

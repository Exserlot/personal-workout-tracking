const DEVICE_ID_KEY = "fitness-workout-device-id";

export function getDeviceId() {
  if (typeof localStorage === "undefined") return "server-rendered-device";
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

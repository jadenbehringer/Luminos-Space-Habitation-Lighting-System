import asyncio
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from tapo import ApiClient

USERNAME = "airbornjerry@gmail.com"
PASSWORD = "AERO_636"
IP_ADDRESS = "172.20.10.2"


class TapoLuxController:
    def __init__(self):
        self.username = USERNAME
        self.password = PASSWORD
        self.ip_address = IP_ADDRESS

        self.control_interval_s = float(os.getenv("TAPO_CONTROL_INTERVAL_S", "0.03"))
        self.tolerance_lux = float(os.getenv("TAPO_TOLERANCE_LUX", "15.0"))
        self.min_step = int(os.getenv("TAPO_BRIGHTNESS_MIN_STEP", "1"))
        self.max_step = int(os.getenv("TAPO_BRIGHTNESS_MAX_STEP", "6"))
        self.error_gain = float(os.getenv("TAPO_BRIGHTNESS_ERROR_GAIN", "0.07"))
        self.command_interval_s = float(os.getenv("TAPO_COMMAND_INTERVAL_S", "0.16"))
        self.reverse_damping_s = float(os.getenv("TAPO_REVERSE_DAMPING_S", "0.45"))
        self.min_brightness = int(os.getenv("TAPO_MIN_BRIGHTNESS", "1"))
        self.max_brightness = int(os.getenv("TAPO_MAX_BRIGHTNESS", "100"))
        self.color_temp = int(os.getenv("TAPO_COLOR_TEMP", "4000"))

        self._lock = threading.Lock()
        self._device = None
        self._last_sensor_ts = 0.0
        self._last_controlled_sensor_ts = 0.0
        self._last_command_ts = 0.0
        self._last_direction = 0
        self._reverse_damp_until_ts = 0.0

        self.state = {
            "online": False,
            "autoEnabled": False,
            "targetLux": 120.0,
            "currentLux": None,
            "brightness": 50,
            "minBrightness": self.min_brightness,
            "maxBrightness": self.max_brightness,
            "toleranceLux": self.tolerance_lux,
            "lastAction": "idle",
            "lastError": None,
        }

        self.loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._loop_thread, daemon=True)
        self._thread.start()

    def _loop_thread(self):
        asyncio.set_event_loop(self.loop)
        self.loop.create_task(self._control_loop())
        self.loop.run_forever()

    async def _connect_device(self, timeout_s=10, retries=3):
        client = ApiClient(self.username, self.password)

        for attempt in range(1, retries + 1):
            try:
                device = await asyncio.wait_for(client.l530(self.ip_address), timeout=timeout_s)
                with self._lock:
                    self.state["online"] = True
                    self.state["lastError"] = None
                return device
            except Exception as exc:
                with self._lock:
                    self.state["online"] = False
                    self.state["lastError"] = f"connect attempt {attempt} failed: {exc}"
                await asyncio.sleep(1)

        raise RuntimeError("Unable to connect to Tapo device")

    async def _ensure_device(self):
        if self._device is None:
            self._device = await self._connect_device()
        return self._device

    async def _apply_brightness_async(self, brightness):
        brightness = max(self.min_brightness, min(self.max_brightness, int(brightness)))
        device = await self._ensure_device()
        await device.on()
        await device.set_brightness(brightness)
        await device.set_color_temperature(self.color_temp)

        with self._lock:
            self.state["brightness"] = brightness
            self.state["online"] = True
            self.state["lastAction"] = f"set brightness {brightness}%"
            self.state["lastError"] = None

    def apply_brightness(self, brightness):
        future = asyncio.run_coroutine_threadsafe(self._apply_brightness_async(brightness), self.loop)
        try:
            future.result(timeout=8)
            return True, None
        except Exception as exc:
            with self._lock:
                self._device = None
                self.state["online"] = False
                self.state["lastError"] = str(exc)
            return False, str(exc)

    async def _control_loop(self):
        while True:
            await asyncio.sleep(self.control_interval_s)

            now = time.monotonic()

            with self._lock:
                auto_enabled = self.state["autoEnabled"]
                target = self.state["targetLux"]
                current = self.state["currentLux"]
                tolerance = self.state["toleranceLux"]
                brightness = self.state["brightness"]
                last_sensor_ts = self._last_sensor_ts

            if not auto_enabled or current is None:
                continue

            # Wait for fresh sensor data and avoid issuing commands too quickly.
            if last_sensor_ts <= self._last_controlled_sensor_ts:
                continue
            if now - self._last_command_ts < self.command_interval_s:
                continue

            error = target - current
            if abs(error) <= tolerance:
                with self._lock:
                    self.state["lastAction"] = "target reached"
                self._last_direction = 0
                continue

            # Very aggressive, banded jumps for rapid convergence.
            abs_error = abs(error)
            if abs_error >= 140:
                step = min(self.max_step, 16)
            elif abs_error >= 100:
                step = min(self.max_step, 12)
            elif abs_error >= 70:
                step = min(self.max_step, 9)
            elif abs_error >= 40:
                step = min(self.max_step, 6)
            else:
                step = int(abs_error * self.error_gain)
                step = max(self.min_step, min(self.max_step, step))

            direction = 1 if error > 0 else -1

            # Dampen when control direction flips (common oscillation source).
            if self._last_direction != 0 and direction != self._last_direction:
                self._reverse_damp_until_ts = now + self.reverse_damping_s
                step = self.min_step
            elif now < self._reverse_damp_until_ts:
                step = min(step, max(self.min_step, 2))

            next_brightness = brightness
            if direction > 0:
                next_brightness = min(self.max_brightness, brightness + step)
            elif direction < 0:
                next_brightness = max(self.min_brightness, brightness - step)

            if next_brightness == brightness:
                with self._lock:
                    self.state["lastAction"] = "brightness limit reached"
                continue

            try:
                await self._apply_brightness_async(next_brightness)
                self._last_command_ts = time.monotonic()
                self._last_controlled_sensor_ts = last_sensor_ts
                self._last_direction = direction
            except Exception as exc:
                with self._lock:
                    self._device = None
                    self.state["online"] = False
                    self.state["lastError"] = str(exc)

    def get_state(self):
        with self._lock:
            return dict(self.state)

    def update_sensor(self, lux):
        with self._lock:
            self.state["currentLux"] = float(lux)
            self._last_sensor_ts = time.monotonic()

    def set_target(self, target_lux):
        with self._lock:
            self.state["targetLux"] = float(target_lux)

    def set_auto(self, enabled):
        with self._lock:
            self.state["autoEnabled"] = bool(enabled)
            self.state["lastAction"] = "auto enabled" if enabled else "auto disabled"


controller = TapoLuxController()


def make_handler(ctrl):
    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, code, payload):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self):
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0:
                return {}
            raw = self.rfile.read(content_length).decode("utf-8")
            return json.loads(raw) if raw else {}

        def do_OPTIONS(self):
            self._send_json(200, {"ok": True})

        def do_GET(self):
            if self.path in ("/state", "/health"):
                self._send_json(200, {"ok": True, "state": ctrl.get_state()})
                return
            self._send_json(404, {"ok": False, "error": "not found"})

        def do_POST(self):
            try:
                data = self._read_json()
            except Exception:
                self._send_json(400, {"ok": False, "error": "invalid json"})
                return

            if self.path == "/sensor":
                lux = data.get("lux")
                if lux is None:
                    self._send_json(400, {"ok": False, "error": "lux is required"})
                    return
                ctrl.update_sensor(lux)
                self._send_json(200, {"ok": True, "state": ctrl.get_state()})
                return

            if self.path == "/target":
                target_lux = data.get("targetLux")
                if target_lux is None:
                    self._send_json(400, {"ok": False, "error": "targetLux is required"})
                    return
                ctrl.set_target(target_lux)
                self._send_json(200, {"ok": True, "state": ctrl.get_state()})
                return

            if self.path == "/auto":
                enabled = data.get("enabled")
                ctrl.set_auto(bool(enabled))
                self._send_json(200, {"ok": True, "state": ctrl.get_state()})
                return

            if self.path == "/brightness":
                brightness = data.get("brightness")
                if brightness is None:
                    self._send_json(400, {"ok": False, "error": "brightness is required"})
                    return
                ok, err = ctrl.apply_brightness(brightness)
                if not ok:
                    self._send_json(500, {"ok": False, "error": err, "state": ctrl.get_state()})
                    return
                self._send_json(200, {"ok": True, "state": ctrl.get_state()})
                return

            self._send_json(404, {"ok": False, "error": "not found"})

        def log_message(self, fmt, *args):
            return

    return Handler


def main():
    host = os.getenv("TAPO_BRIDGE_HOST", "127.0.0.1")
    port = int(os.getenv("TAPO_BRIDGE_PORT", "8765"))

    server = ThreadingHTTPServer((host, port), make_handler(controller))
    print(f"Tapo bridge listening on http://{host}:{port}")
    print("Endpoints: GET /state, POST /sensor, POST /target, POST /auto, POST /brightness")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

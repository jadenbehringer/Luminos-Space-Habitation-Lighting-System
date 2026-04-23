import asyncio
import concurrent.futures
from collections import deque
import json
import logging
import math
import os
import socket
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from tapo import ApiClient

USERNAME = "airbornjerry@gmail.com"
PASSWORD = "AERO_636"
IP_ADDRESS = "172.20.10.2"
IP_ADDRESS_LIST = [IP_ADDRESS]


def _configure_logging():
    level_name = os.getenv("TAPO_LOG_LEVEL", "DEBUG").upper()
    level = getattr(logging, level_name, logging.DEBUG)
    log_file = os.getenv("TAPO_LOG_FILE", "tapo_bridge.log")

    logger = logging.getLogger("tapo_bridge")
    if logger.handlers:
        return logger

    logger.setLevel(level)
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(threadName)s | %(name)s | %(message)s"
    )

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(level)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    try:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception:
        logger.warning("Could not open log file '%s'; continuing with console-only logs", log_file)

    logger.propagate = False
    logger.info("Logging initialized level=%s file=%s", logging.getLevelName(level), log_file)
    return logger


LOGGER = _configure_logging()


class TapoLuxController:
    def __init__(self):
        self.username = USERNAME
        self.password = PASSWORD
        self.ip_addresses = IP_ADDRESS_LIST

        self.connect_timeout_s = float(os.getenv("TAPO_CONNECT_TIMEOUT_S", "10"))
        self.connect_retries = int(os.getenv("TAPO_CONNECT_RETRIES", "3"))

        self.control_interval_s = float(os.getenv("TAPO_CONTROL_INTERVAL_S", "0.04"))
        self.tolerance_lux = float(os.getenv("TAPO_TOLERANCE_LUX", "25.0"))
        self.min_step = int(os.getenv("TAPO_BRIGHTNESS_MIN_STEP", "1"))
        self.max_step = int(os.getenv("TAPO_BRIGHTNESS_MAX_STEP", "5")) # Heavily reduce max step to smooth out big jumps
        self.exp_small_error_lux = float(os.getenv("TAPO_EXP_SMALL_ERROR_LUX", "100.0"))
        self.exp_gain = float(os.getenv("TAPO_EXP_GAIN", "0.02"))
        self.command_interval_s = float(os.getenv("TAPO_COMMAND_INTERVAL_S", "0.8")) # Allow physical bulb response time
        self.close_error_lux = float(os.getenv("TAPO_CLOSE_ERROR_LUX", "70.0"))
        self.close_command_interval_s = float(os.getenv("TAPO_CLOSE_COMMAND_INTERVAL_S", "2.5")) # Extra padding near target
        self.reverse_damping_s = float(os.getenv("TAPO_REVERSE_DAMPING_S", "3.0")) # Big damping on direction toggle
        self.min_brightness = int(os.getenv("TAPO_MIN_BRIGHTNESS", "1"))
        self.max_brightness = int(os.getenv("TAPO_MAX_BRIGHTNESS", "100"))
        self.color_temp = int(os.getenv("TAPO_COLOR_TEMP", "4000"))
        self.moving_avg_window = max(1, int(os.getenv("TAPO_MOVING_AVG_WINDOW", "6"))) # Smooth out jitter

        self._lock = threading.Lock()
        self._device = None
        self._lux_samples = deque(maxlen=self.moving_avg_window)
        self._last_sensor_ts = 0.0
        self._last_controlled_sensor_ts = 0.0
        self._last_command_ts = 0.0
        self._last_direction = 0
        self._reverse_damp_until_ts = 0.0

        self.state = {
            "online": False,
            "powerOn": True,
            "autoEnabled": False,
            "targetLux": 120.0,
            "currentLux": None,
            "brightness": 50,
            "minBrightness": self.min_brightness,
            "maxBrightness": self.max_brightness,
            "toleranceLux": self.tolerance_lux,
            "lastAction": "idle",
            "lastError": None,
            "connectedIp": None,
        }

        self.loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._loop_thread, daemon=True)
        self._thread.start()
        LOGGER.info(
            "Controller initialized ips=%s retries=%s timeout_s=%.2f control_interval_s=%.3f",
            self.ip_addresses,
            self.connect_retries,
            self.connect_timeout_s,
            self.control_interval_s,
        )

    def _build_connect_diagnostics(self, ip):
        diagnostics = {
            "targetIp": ip,
            "hostname": socket.gethostname(),
            "resolvedTarget": None,
            "localRouteIp": None,
            "tcp80Reachable": False,
            "tcp443Reachable": False,
        }

        try:
            diagnostics["resolvedTarget"] = socket.gethostbyname(ip)
        except Exception as exc:
            diagnostics["resolvedTarget"] = f"resolve failed: {exc}"

        try:
            probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            probe.settimeout(1.0)
            probe.connect((ip, 1))
            diagnostics["localRouteIp"] = probe.getsockname()[0]
            probe.close()
        except Exception as exc:
            diagnostics["localRouteIp"] = f"route probe failed: {exc}"

        for port, key in ((80, "tcp80Reachable"), (443, "tcp443Reachable")):
            try:
                with socket.create_connection((ip, port), timeout=1.5):
                    diagnostics[key] = True
            except Exception:
                diagnostics[key] = False

        return diagnostics

    def _loop_thread(self):
        asyncio.set_event_loop(self.loop)
        self.loop.create_task(self._control_loop())
        self.loop.run_forever()

    async def _connect_device(self, timeout_s=None, retries=None):
        timeout_s = float(timeout_s or self.connect_timeout_s)
        retries = int(retries or self.connect_retries)

        client = ApiClient(self.username, self.password)
        last_exc = None

        targets = tuple(self.ip_addresses)

        for attempt in range(1, retries + 1):
            for ip in targets:
                diagnostics = self._build_connect_diagnostics(ip)
                LOGGER.info(
                    "Connect attempt %s/%s to ip=%s diagnostics=%s",
                    attempt,
                    retries,
                    ip,
                    json.dumps(diagnostics, sort_keys=True),
                )
                try:
                    device = await asyncio.wait_for(client.l530(ip), timeout=timeout_s)
                    with self._lock:
                        self.state["online"] = True
                        self.state["connectedIp"] = ip
                        self.state["lastError"] = None
                    LOGGER.info("Connected to bulb ip=%s on attempt=%s", ip, attempt)
                    return device
                except asyncio.TimeoutError:
                    last_exc = RuntimeError(f"timeout after {timeout_s}s to {ip}")
                    LOGGER.warning("Timeout connecting to ip=%s timeout_s=%.2f", ip, timeout_s)
                except Exception as exc:
                    last_exc = exc
                    LOGGER.error(
                        "Connection exception ip=%s type=%s message=%s",
                        ip,
                        type(exc).__name__,
                        exc,
                    )
                    LOGGER.debug("Traceback for connection failure:\n%s", traceback.format_exc())

            msg = (
                f"connect attempt {attempt} failed: {last_exc}. "
                "Check hardcoded bulb IP, same Wi-Fi/subnet, and TP-Link credentials."
            )
            with self._lock:
                self.state["online"] = False
                self.state["lastError"] = msg
            LOGGER.warning(msg)

            if attempt < retries:
                await asyncio.sleep(1)

        LOGGER.error(
            "All connection attempts failed retries=%s targets=%s last_error=%s",
            retries,
            list(targets),
            last_exc,
        )
        raise RuntimeError(
            f"Unable to connect to Tapo bulb after {retries} attempts across {len(targets)} IP(s): {last_exc}"
        )

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
            self.state["powerOn"] = True
            self.state["online"] = True
            self.state["lastAction"] = f"set brightness {brightness}%"
            self.state["lastError"] = None

    async def _set_power_async(self, on):
        device = await self._ensure_device()
        if on:
            await device.on()
        else:
            await device.off()

        with self._lock:
            self.state["powerOn"] = bool(on)
            self.state["online"] = True
            self.state["lastAction"] = "power on" if on else "power off"
            self.state["lastError"] = None

    def apply_brightness(self, brightness):
        future = asyncio.run_coroutine_threadsafe(self._apply_brightness_async(brightness), self.loop)
        try:
            future.result(timeout=8)
            return True, None
        except Exception as exc:
            LOGGER.error("apply_brightness failed brightness=%s error=%s", brightness, exc)
            LOGGER.debug("Traceback for apply_brightness failure:\n%s", traceback.format_exc())
            with self._lock:
                self._device = None
                self.state["online"] = False
                self.state["lastError"] = str(exc)
            return False, str(exc)

    def set_power(self, on):
        future = asyncio.run_coroutine_threadsafe(self._set_power_async(bool(on)), self.loop)
        try:
            future.result(timeout=8)
            return True, None
        except Exception as exc:
            LOGGER.error("set_power failed on=%s error=%s", bool(on), exc)
            LOGGER.debug("Traceback for set_power failure:\n%s", traceback.format_exc())
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
                lux_samples = tuple(self._lux_samples)
                tolerance = self.state["toleranceLux"]
                brightness = self.state["brightness"]
                last_sensor_ts = self._last_sensor_ts

            if not auto_enabled or current is None:
                continue

            if len(lux_samples) < self.moving_avg_window:
                continue

            avg_lux = sum(lux_samples) / len(lux_samples)
            error = target - avg_lux

            command_interval = self.command_interval_s
            if abs(error) <= self.close_error_lux:
                command_interval = max(self.command_interval_s, self.close_command_interval_s)

            # Wait for fresh sensor data and avoid issuing commands too quickly.
            if last_sensor_ts <= self._last_controlled_sensor_ts:
                continue
            if now - self._last_command_ts < command_interval:
                continue

            if abs(error) <= tolerance:
                with self._lock:
                    self.state["lastAction"] = "target reached"
                self._last_direction = 0
                continue

            # Exponential step curve:
            # - keep step very small near target (<= exp_small_error_lux)
            # - ramp quickly beyond that threshold
            abs_error = abs(error)
            if abs_error <= self.exp_small_error_lux:
                step = self.min_step
            else:
                excess = abs_error - self.exp_small_error_lux
                curve = 1.0 - math.exp(-self.exp_gain * excess)
                scaled = self.min_step + (self.max_step - self.min_step) * curve
                step = int(round(scaled))
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
                LOGGER.error("control loop brightness apply failed next=%s error=%s", next_brightness, exc)
                LOGGER.debug("Traceback for control loop failure:\n%s", traceback.format_exc())
                with self._lock:
                    self._device = None
                    self.state["online"] = False
                    self.state["lastError"] = str(exc)

    def get_state(self):
        with self._lock:
            return dict(self.state)

    def update_sensor(self, lux):
        with self._lock:
            value = float(lux)
            self.state["currentLux"] = value
            self._lux_samples.append(value)
            self._last_sensor_ts = time.monotonic()

    def set_target(self, target_lux):
        with self._lock:
            self.state["targetLux"] = float(target_lux)

    def set_auto(self, enabled):
        with self._lock:
            self.state["autoEnabled"] = bool(enabled)
            self.state["lastAction"] = "auto enabled" if enabled else "auto disabled"

    def enable_auto_with_connect(self):
        future = asyncio.run_coroutine_threadsafe(self._ensure_device(), self.loop)
        per_round = self.connect_timeout_s * max(1, len(self.ip_addresses))
        retry_gaps = max(0, self.connect_retries - 1) * 1.0
        timeout = max(8.0, (per_round * self.connect_retries) + retry_gaps + 3.0)
        try:
            future.result(timeout=timeout)
            with self._lock:
                self.state["autoEnabled"] = True
                self.state["online"] = True
                self.state["lastAction"] = "auto enabled (connection verified)"
                self.state["lastError"] = None
            LOGGER.info("Auto enable succeeded; connection verified before activation")
            return True, None
        except concurrent.futures.TimeoutError:
            future.cancel()
            msg = (
                f"Auto enable connect-check timed out after {timeout:.1f}s "
                f"(retries={self.connect_retries}, ips={len(self.ip_addresses)})."
            )
            LOGGER.error(msg)
            with self._lock:
                self._device = None
                self.state["autoEnabled"] = False
                self.state["online"] = False
                self.state["lastAction"] = "auto enable failed"
                self.state["lastError"] = msg
            return False, msg
        except Exception as exc:
            LOGGER.error("Auto enable failed; connection could not be verified: %s", exc)
            LOGGER.debug("Traceback for auto enable connection failure:\n%s", traceback.format_exc())
            with self._lock:
                self._device = None
                self.state["autoEnabled"] = False
                self.state["online"] = False
                self.state["lastAction"] = "auto enable failed"
                self.state["lastError"] = str(exc)
            return False, str(exc)


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
                enabled = bool(enabled)
                if enabled:
                    ok, err = ctrl.enable_auto_with_connect()
                    if not ok:
                        self._send_json(500, {"ok": False, "error": err, "state": ctrl.get_state()})
                        return
                else:
                    ctrl.set_auto(False)
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

            if self.path == "/power":
                on = data.get("on")
                if on is None:
                    self._send_json(400, {"ok": False, "error": "on is required"})
                    return
                ok, err = ctrl.set_power(bool(on))
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
    LOGGER.info("Tapo bridge listening on http://%s:%s", host, port)
    LOGGER.info("Endpoints: GET /state, POST /sensor, POST /target, POST /auto, POST /brightness, POST /power")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOGGER.info("KeyboardInterrupt received; shutting down server")
    finally:
        server.server_close()
        LOGGER.info("Server closed")


if __name__ == "__main__":
    main()

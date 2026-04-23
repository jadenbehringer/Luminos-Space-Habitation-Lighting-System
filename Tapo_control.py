# -*- coding: utf-8 -*-
"""
Created on Sat Apr 18 14:12:51 2026

@author: gavin
"""

import asyncio
import os
from tapo import ApiClient
import numpy as np


async def connect_device(user, passw, ip, timeout_s=10, retries=3):
        """Connect to a Tapo L530 with retry + timeout handling."""
        client = ApiClient(user, passw)

        for attempt in range(1, retries + 1):
                try:
                        print(f"Connecting to {ip} (attempt {attempt}/{retries})...")
                        device = await asyncio.wait_for(client.l530(ip), timeout=timeout_s)
                        print("Connected.")
                        return device
                except asyncio.TimeoutError:
                        print(f"Connection timed out after {timeout_s}s.")
                except Exception as exc:
                        print(f"Connection failed: {exc}")

                if attempt < retries:
                        await asyncio.sleep(1)

        raise RuntimeError(
                f"Could not connect to Tapo device at {ip}. "
                "Verify IP, same Wi-Fi/subnet, and credentials."
        )


async def change_light(device, bright, warmth):
        await device.on()
        await device.set_brightness(int(bright))
        await device.set_color_temperature(int(warmth))


USERNAME = os.getenv("TAPO_USERNAME", "airbornjerry@gmail.com")
PASSWORD = os.getenv("TAPO_PASSWORD", "AERO_636")
IP_ADDRESS = os.getenv("TAPO_IP", "172.20.10.2")

warm_low = 2500
warm_high = 5000
light_low = 10
light_high = 100

warm = np.concatenate([np.linspace(warm_low, warm_high, 9), np.linspace(warm_high, warm_low, 9)])
light = np.concatenate([np.linspace(light_low, light_high, 9), np.linspace(light_high, light_low, 9)])


async def main():
        device = await connect_device(USERNAME, PASSWORD, IP_ADDRESS)

        for i in range(18):
                await change_light(device, light[i], warm[i])
                await asyncio.sleep(1)


if __name__ == "__main__":
        try:
                asyncio.run(main())
        except KeyboardInterrupt:
                print("Stopped by user.")
    
    
    
    
    



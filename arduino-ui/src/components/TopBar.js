/**
 * TopBar.js
 * ---------
 * Persistent top status bar displayed across the full width of the dashboard.
 *
 * Left side:
 *   • ASTROVIEW // ADAPTIVE WINDOW SYSTEM — mission system name / brand mark
 *
 * Right side (status pills + controls):
 *   • Serial state label  – "SERIAL UNSUPPORTED" | "ARDUINO LUX LIVE" | "SIM MODE"
 *       SERIAL UNSUPPORTED – browser does not support the Web Serial API
 *       ARDUINO LUX LIVE   – a serial port is open and streaming data
 *       SIM MODE           – serial supported but no device connected; using simulation
 *
 *   • BRIDGE pill         – green "ONLINE" / red "OFFLINE" indicating whether the
 *                           Tapo Bridge HTTP server is reachable at its configured URL
 *
 *   • BULB pill           – green "CONNECTED" / red "DISCONNECTED" reflecting the
 *                           physical smart bulb's Wi-Fi reachability as reported by
 *                           the bridge (distinct from bridge reachability)
 *
 *   • Connect Arduino btn – shown only when Web Serial is supported but no device
 *                           is connected; triggers the browser's port-picker dialog
 *
 *   • MET clock           – Mission Elapsed Time in HH:MM:SS format, updated every
 *                           150 ms by the simulation loop in useLiveData
 *
 * Props:
 *   missionTime      – "HH:MM:SS" string for the MET clock
 *   serialSupported  – boolean | undefined; false = browser lacks Web Serial API
 *   serialConnected  – boolean; true while an Arduino serial port is open
 *   serialError      – string | null; last serial error message to display
 *   onConnectSerial  – callback to open the browser's port-picker dialog
 *   bridgeReachable  – boolean; true when the Tapo Bridge HTTP server responds
 *   bulbOnline       – boolean; true when the physical bulb is reachable over Wi-Fi
 */

import styles from './TopBar.module.css';

export default function TopBar({
  missionTime,
  serialSupported,
  serialConnected,
  serialError,
  onConnectSerial,
  bridgeReachable,
  bulbOnline,
}) {
  return (
    <div className={styles.bar}>
      {/* System name / brand mark */}
      <div className={styles.logo}>ASTROVIEW // ADAPTIVE WINDOW SYSTEM</div>

      <div className={styles.right}>
        {/* Serial connection status label */}
        <span className={styles.serialState}>
          {typeof serialSupported === 'boolean' && !serialSupported
            ? 'SERIAL UNSUPPORTED'           // browser doesn't have Web Serial API
            : serialConnected
              ? 'ARDUINO LUX LIVE'           // port open, sensor streaming
              : 'SIM MODE'}                  // serial available but no device connected
        </span>

        {/* Tapo Bridge HTTP server reachability pill */}
        <span className={`${styles.protoPill} ${bridgeReachable ? styles.protoOk : styles.protoBad}`}>
          BRIDGE {bridgeReachable ? 'ONLINE' : 'OFFLINE'}
        </span>

        {/* Physical smart bulb Wi-Fi reachability pill */}
        <span className={`${styles.protoPill} ${bulbOnline ? styles.protoOk : styles.protoBad}`}>
          BULB {bulbOnline ? 'CONNECTED' : 'DISCONNECTED'}
        </span>

        {/* Connect button — only visible when serial is supported but disconnected.
            Must be triggered by a user gesture to satisfy browser security policy. */}
        {serialSupported && !serialConnected && (
          <button className={styles.serialBtn} onClick={onConnectSerial} type="button">
            Connect Arduino
          </button>
        )}

        {/* Mission Elapsed Time clock */}
        <span className={styles.time}>MET {missionTime}</span>
      </div>

      {/* Serial error banner — only rendered when a serial error is present */}
      {serialError && <div className={styles.serialError}>Serial error: {serialError}</div>}
    </div>
  );
}

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
      <div className={styles.logo}>LUMINOS // ADAPTIVE WINDOW SYSTEM</div>
      <div className={styles.right}>
        <span className={styles.serialState}>
          {typeof serialSupported === 'boolean' && !serialSupported
            ? 'SERIAL UNSUPPORTED'
            : serialConnected
              ? 'ARDUINO LUX LIVE'
              : 'SIM MODE'}
        </span>
        <span className={`${styles.protoPill} ${bridgeReachable ? styles.protoOk : styles.protoBad}`}>
          BRIDGE {bridgeReachable ? 'ONLINE' : 'OFFLINE'}
        </span>
        <span className={`${styles.protoPill} ${bulbOnline ? styles.protoOk : styles.protoBad}`}>
          BULB {bulbOnline ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
        {serialSupported && !serialConnected && (
          <button className={styles.serialBtn} onClick={onConnectSerial} type="button">
            Connect Arduino
          </button>
        )}
        <span className={styles.time}>MET {missionTime}</span>
      </div>
      {serialError && <div className={styles.serialError}>Serial error: {serialError}</div>}
    </div>
  );
}

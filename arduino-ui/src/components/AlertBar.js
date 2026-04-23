import styles from './AlertBar.module.css';

const LEVELS = {
  emergency: { label: 'EMERGENCY', symbol: '■', cls: 'emergency' },
  caution:   { label: 'CAUTION',   symbol: '▲', cls: 'caution' },
  null:      { label: 'NOMINAL',   symbol: '●', cls: 'nominal' },
};

export default function AlertBar({ episode, reward, solarAlert, alertLevel, lux }) {
  const key = alertLevel ?? 'null';
  const { label, symbol, cls } = LEVELS[key];

  let message;
  if (alertLevel === 'emergency') {
    message = 'SOLAR FLARE DETECTED — ENGAGING EMERGENCY BLACKOUT PROTOCOL';
  } else if (alertLevel === 'caution') {
    message = `LUX OUT OF TOLERANCE — CURRENT: ${lux} LUX  TARGET: 320 LUX`;
  } else {
    message = `SYSTEM NOMINAL — ML MODEL TRAINING — EPISODE ${episode} — REWARD: +${reward}`;
  }

  return (
    <div className={`${styles.bar} ${styles[cls]}`}>
      <span className={styles.badge}>
        <span className={styles.symbol}>{symbol}</span>
        {label}
      </span>
      <span className={styles.message}>{message}</span>
    </div>
  );
}

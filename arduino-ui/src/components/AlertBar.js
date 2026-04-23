import styles from './AlertBar.module.css';

const LEVELS = {
  emergency: { label: 'EMERGENCY', symbol: '■', cls: 'emergency' },
  caution:   { label: 'CAUTION',   symbol: '▲', cls: 'caution' },
  null:      { label: 'NOMINAL',   symbol: '●', cls: 'nominal' },
};

export default function AlertBar({ alertLevel, lux }) {
  const key = alertLevel ?? 'null';
  const { label, symbol, cls } = LEVELS[key];

  let message;
  if (alertLevel === 'emergency') {
    message = `SYSTEM ALERT — CURRENT LUX ${lux}`;
  } else if (alertLevel === 'caution') {
    message = `LUX OUT OF RANGE — CURRENT ${lux}`;
  } else {
    message = `SYSTEM NOMINAL — CURRENT LUX ${lux}`;
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

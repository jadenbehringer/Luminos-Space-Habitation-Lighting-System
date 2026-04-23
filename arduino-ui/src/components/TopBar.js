import styles from './TopBar.module.css';

const STATUS = {
  emergency: { label: 'EMERGENCY', cls: 'emergency' },
  caution:   { label: 'CAUTION',   cls: 'caution' },
  null:      { label: 'NOMINAL',   cls: 'nominal' },
};

export default function TopBar({ missionTime, alertLevel }) {
  const key = alertLevel ?? 'null';
  const { label, cls } = STATUS[key];

  return (
    <div className={styles.bar}>
      <div className={styles.logo}>LUMINOS // ADAPTIVE WINDOW SYSTEM</div>
      <div className={styles.right}>
        <span className={`${styles.pill} ${styles[cls]}`}>
          {label}
        </span>
        <span className={styles.time}>MET {missionTime}</span>
      </div>
    </div>
  );
}

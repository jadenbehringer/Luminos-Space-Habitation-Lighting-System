import { PROFILES } from '../data/dummy';
import styles from './ProfilesPanel.module.css';

export default function ProfilesPanel({ activeProfile }) {
  const sortedProfiles = [...PROFILES].sort((a, b) => a.targetLux - b.targetLux);

  return (
    <div className={styles.section}>
      <div className={styles.label}>Lighting profiles</div>

      <div className={styles.grid}>
        {sortedProfiles.map((p) => (
          <div key={p.id} className={`${styles.card} ${activeProfile === p.id ? styles.active : ''}`}>
            {activeProfile === p.id && <div className={styles.activeBadge}>ACTIVE</div>}
            <div className={styles.icon}>{p.icon}</div>
            <div className={styles.name}>{p.name}</div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Lux</span>
              <span className={styles.metricValue}>{p.targetLux}</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Blue light</span>
              <span className={styles.metricValue}>{p.blueLightLevel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
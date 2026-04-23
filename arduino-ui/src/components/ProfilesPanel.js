import { PROFILES } from '../data/dummy';
import styles from './ProfilesPanel.module.css';

const profileNames = ['work', 'circadian', 'sleep'];

export default function ProfilesPanel({ activeProfile, mlWeights }) {
  return (
    <div className={styles.section}>
      <div className={styles.label}>Lighting profiles</div>

      <div className={styles.grid}>
        {PROFILES.map((p, i) => (
          <div key={p.id} className={`${styles.card} ${activeProfile === p.id ? styles.active : ''}`}>
            {activeProfile === p.id && <div className={styles.activeBadge}>ACTIVE</div>}
            <div className={styles.icon}>{p.icon}</div>
            <div className={styles.name}>{p.name}</div>
            <div className={styles.desc}>{p.desc}</div>
            <div className={styles.target}>{p.targetRange}</div>
          </div>
        ))}
      </div>

      <div className={styles.mlBox}>
        <div className={styles.mlLabel}>TF model — learned profile weights</div>
        {profileNames.map((name, i) => (
          <div key={name} className={styles.mlRow}>
            <span className={styles.mlName}>{name.toUpperCase()}</span>
            <div className={styles.mlBarBg}>
              <div
                className={styles.mlBarFill}
                style={{ width: `${Math.min(100, (mlWeights[i] / 2) * 100)}%` }}
              />
            </div>
            <span className={styles.mlWeight}>{mlWeights[i]?.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
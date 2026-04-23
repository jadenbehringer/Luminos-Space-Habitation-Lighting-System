import { CREW } from '../data/dummy';
import styles from './CrewPanel.module.css';

const activityColors = {
  work: { bg: 'rgba(0,200,255,0.1)', color: '#00c8ff' },
  sleep: { bg: 'rgba(100,50,200,0.15)', color: '#a080ff' },
  eva: { bg: 'rgba(255,200,0,0.1)', color: '#ffc800' },
  exercise: { bg: 'rgba(0,255,136,0.1)', color: '#00ff88' },
};

export default function CrewPanel() {
  return (
    <div className={styles.panel}>
      <div className={styles.label}>Astronaut profiles</div>

      {CREW.map(member => {
        const ac = activityColors[member.activityClass];
        return (
          <div key={member.id} className={`${styles.card} ${member.active ? styles.active : ''}`}>
            <div className={styles.callsign}>{member.designation} {member.name}</div>
            <span className={styles.activity} style={{ background: ac.bg, color: ac.color }}>
              {member.activity}
            </span>
            <div className={styles.meta}>
              Target lux: <span style={{ color: member.color, fontFamily: 'Space Mono, monospace' }}>{member.targetLux}</span>
            </div>
            {member.active && (
              <div className={styles.meta}>
                Overrides: <span style={{ color: member.color, fontFamily: 'Space Mono, monospace' }}>{member.overrides}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
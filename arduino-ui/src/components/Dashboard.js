import { useLiveData } from '../hooks/useLiveData';
import TopBar from './TopBar';
import CrewPanel from './CrewPanel';
import LightGauge from './LightGauge';
import LightChart from './LightChart';
import ProfilesPanel from './ProfilesPanel';
import ServosPanel from './ServosPanel';
import AlertBar from './AlertBar';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const data = useLiveData();
  return (
    <div className={styles.dash}>
      <TopBar
        missionTime={data.missionTime}
        alertLevel={data.alertLevel}
        serialSupported={data.serialSupported}
        serialConnected={data.serialConnected}
        serialError={data.serialError}
        onConnectSerial={data.connectSerial}
      />
      <div className={styles.grid}>
        <CrewPanel orbitPct={data.orbitPct} orbitPhase={data.orbitPhase} />
        <div className={styles.center}>
          <LightGauge lux={data.lux} raw={data.raw} circadian={data.circadian} fused={data.fused} />
          <LightChart history={data.history} />
          <ProfilesPanel activeProfile={data.activeProfile} mlWeights={data.mlWeights} />
        </div>
        <ServosPanel servoPositions={data.servoPositions} solarDelta={data.solarDelta} solarAlert={data.solarAlert} />
      </div>
      <AlertBar episode={data.episode} reward={data.reward} solarAlert={data.solarAlert} alertLevel={data.alertLevel} lux={data.lux} />
    </div>
  );
}
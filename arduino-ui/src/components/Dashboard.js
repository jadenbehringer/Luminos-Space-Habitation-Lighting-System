import { useLiveData } from '../hooks/useLiveData';
import { useTapoBridge } from '../hooks/useTapoBridge';
import TopBar from './TopBar';
import CrewPanel from './CrewPanel';
import AlertBar from './AlertBar';
import TapoControlPanel from './TapoControlPanel';
import LightChart from './LightChart';
import ProfilesPanel from './ProfilesPanel';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const data = useLiveData();
  const bridgeData = useTapoBridge(data.lux);

  return (
    <div className={styles.dash}>
      <TopBar
        missionTime={data.missionTime}
        alertLevel={data.alertLevel}
        serialSupported={data.serialSupported}
        serialConnected={data.serialConnected}
        serialError={data.serialError}
        onConnectSerial={data.connectSerial}
        bridgeReachable={bridgeData.bridgeReachable}
        bulbOnline={bridgeData.bridge.online}
      />
      <div className={styles.grid}>
        <CrewPanel />
        <div className={styles.center}>
          <TapoControlPanel lux={data.lux} bridgeData={bridgeData} />
          <LightChart history={data.history} />
        </div>
        <ProfilesPanel activeProfile={data.activeProfile} />
      </div>
      <AlertBar alertLevel={data.alertLevel} lux={data.lux} />
    </div>
  );
}
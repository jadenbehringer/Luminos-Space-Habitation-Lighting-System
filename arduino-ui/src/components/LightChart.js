import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './LightChart.module.css';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(0,20,50,0.95)',
        border: '0.5px solid rgba(0,200,255,0.3)',
        borderRadius: 6,
        padding: '6px 10px',
        fontFamily: 'Space Mono, monospace',
        fontSize: 11,
        color: '#00c8ff',
      }}>
        {Math.round(payload[0].value)}
      </div>
    );
  }
  return null;
};

export default function LightChart({ history }) {
  const chartData = history.map((v, i) => ({ i, v: Math.round(v) }));

  return (
    <div className={styles.section}>
      <div className={styles.label}>Light level history — 60s window</div>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="lightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00c8ff" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00c8ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="i" hide />
            <YAxis
              domain={[0, 1023]}
              tick={{ fill: 'rgba(200,216,240,0.3)', fontSize: 9, fontFamily: 'Space Mono' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#00c8ff"
              strokeWidth={1.5}
              fill="url(#lightGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
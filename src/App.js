import React, { useEffect, useState } from 'react';
import { ref, onValue, remove } from "firebase/database";
import { db } from "./firebase";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#1e293b', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', padding: '30px', color: '#f8fafc' },
  header: { color: '#38bdf8', textAlign: 'center', marginBottom: '40px', letterSpacing: '1px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
  dashboardGrid: { display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '30px' },
  leftColumn: { flex: '1', minWidth: '300px', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' },
  card: { backgroundColor: '#334155', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', borderLeft: '5px solid #38bdf8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { margin: '0', color: '#94a3b8', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' },
  cardValue: { fontSize: '32px', fontWeight: 'bold', margin: '0', color: '#f8fafc' },
  unit: { fontSize: '16px', color: '#94a3b8', fontWeight: 'normal' },
  rightColumn: { flex: '2', minWidth: '500px', backgroundColor: '#334155', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' },
  statusBox: { textAlign: 'center', padding: '20px', borderRadius: '15px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', color: '#4ade80', fontSize: '18px', fontWeight: 'bold', maxWidth: '800px', margin: '0 auto' },
  
  overlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  modal: { backgroundColor: '#1e293b', border: '3px solid #ef4444', padding: '30px', borderRadius: '15px', width: '90%', maxWidth: '700px', boxShadow: '0 0 50px rgba(239, 68, 68, 0.8)', animation: 'pulse 1.5s infinite' },
  alertTitle: { color: '#f87171', margin: '0 0 15px 0', fontSize: '32px', textAlign: 'center' },
  alertText: { fontSize: '18px', color: '#e2e8f0', margin: '8px 0', textAlign: 'center' },
  
  // CSS cho 2 nút bấm
  btnGroup: { display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '25px' },
  btnSafe: { padding: '15px 30px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(34, 197, 94, 0.4)' },
  btnFalseAlarm: { padding: '15px 30px', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(71, 85, 105, 0.4)' }
};

function App() {
  const [healthData, setHealthData] = useState({ heart_rate: '--', spo2: '--' });
  const [activeFall, setActiveFall] = useState(null);
  const [chartData, setChartData] = useState([]); 

  useEffect(() => {
    // Lắng nghe dữ liệu (Chỉ lấy heart_rate và spo2)
    const healthRef = ref(db, 'devices/device_01/health');
    onValue(healthRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setHealthData(data);
        
        setChartData(prevData => {
          const newData = [...prevData, { 
            time: new Date().toLocaleTimeString(), 
            bpm: data.heart_rate,
            spo2: data.spo2
          }];
          // Giữ lại 15 điểm gần nhất (tương đương ~ 3.5 tiếng nếu 15p/lần)
          if (newData.length > 15) return newData.slice(newData.length - 15);
          return newData;
        });
      }
    });

    // Lắng nghe sự kiện té ngã
    const eventsRef = ref(db, 'devices/device_01/events');
    onValue(eventsRef, (snapshot) => {
      if (snapshot.exists()) {
        const events = snapshot.val();
        let foundFall = null;
        for (const key in events) {
          if (events[key].type?.toLowerCase() === 'fall') { 
            foundFall = { id: key, data: events[key] };
            break;
          }
        }
        setActiveFall(foundFall);
      } else {
        setActiveFall(null);
      }
    });
  }, []);

  // Hàm xử lý khi bấm nút (Dùng chung cho cả báo an toàn và báo động nhầm)
  const handleResolveEvent = () => {
    if (activeFall) {
      const eventRef = ref(db, `devices/device_01/events/${activeFall.id}`);
      remove(eventRef).then(() => setActiveFall(null));
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
          50% { box-shadow: 0 0 60px rgba(239, 68, 68, 1); }
          100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
        }
      `}</style>

      <h1 style={styles.header}>🏥 HỆ THỐNG GIÁM SÁT Y TẾ</h1>
      
      <div style={styles.dashboardGrid}>
        {/* CỘT TRÁI: THÔNG SỐ */}
        <div style={styles.leftColumn}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>❤️ Nhịp tim</h3>
            <p style={styles.cardValue}>{healthData.heart_rate} <span style={styles.unit}>bpm</span></p>
          </div>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>🫁 Nồng độ Oxy</h3>
            <p style={styles.cardValue}>{healthData.spo2}<span style={styles.unit}>%</span></p>
          </div>
        </div>

        {/* CỘT PHẢI: BIỂU ĐỒ KÉP */}
        <div style={styles.rightColumn}>
          <h3 style={{ margin: '0 0 20px 0', color: '#94a3b8', textAlign: 'center' }}>📈 Biểu đồ Nhịp tim & Nồng độ Oxy</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                {/* Trục trái cho Nhịp tim */}
                <YAxis yAxisId="left" stroke="#f87171" domain={['dataMin - 10', 'dataMax + 10']} />
                {/* Trục phải cho SpO2 */}
                <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" domain={[90, 100]} />
                
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff' }} />
                <Legend />
                <Line yAxisId="left" type="monotone" name="Nhịp tim (bpm)" dataKey="bpm" stroke="#f87171" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" name="SpO2 (%)" dataKey="spo2" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TRẠNG THÁI BÊN DƯỚI */}
      {!activeFall && (
        <div style={styles.statusBox}>
          <p>✅ Hệ thống đang hoạt động bình thường. Không phát hiện bất thường.</p>
        </div>
      )}

      {/* POPUP CẢNH BÁO */}
      {activeFall && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.alertTitle}>🚨 PHÁT HIỆN TÉ NGÃ!</h2>
            <p style={styles.alertText}><strong>Thời gian:</strong> {activeFall.data.timestamp}</p>
            <p style={styles.alertText}><strong>Vị trí GPS:</strong> {activeFall.data.latitude}, {activeFall.data.longitude}</p>
            
            <div style={{ height: '250px', width: '100%', marginTop: '20px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #ef4444' }}>
              <MapContainer 
                center={[activeFall.data.latitude, activeFall.data.longitude]} 
                zoom={16} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[activeFall.data.latitude, activeFall.data.longitude]}>
                  <Popup>Bệnh nhân đang ở đây!</Popup>
                </Marker>
              </MapContainer>
            </div>

            {/* HAI NÚT BẤM XỬ LÝ */}
            <div style={styles.btnGroup}>
              <button style={styles.btnSafe} onClick={handleResolveEvent}>
                ✅ Xác nhận an toàn
              </button>
              <button style={styles.btnFalseAlarm} onClick={handleResolveEvent}>
                ❌ Báo động nhầm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
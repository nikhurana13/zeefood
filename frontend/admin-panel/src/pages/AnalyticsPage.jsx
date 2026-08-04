import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { api } from '../utils/api';

const RESTAURANT_ID = 'demo-restaurant-1';

// Generate mock 24h data
const MOCK_DEMAND = Array.from({ length: 24 }, (_, i) => {
  const base = [0.2,0.1,0.05,0.05,0.05,0.1,0.3,0.6,0.9,0.7,0.5,0.8,1.0,0.9,0.6,0.5,0.4,0.5,0.7,0.9,1.0,0.8,0.5,0.3];
  return {
    hour: `${i < 10 ? '0' : ''}${i}:00`,
    expected_orders: Math.max(2, Math.round(base[i] * 30 + Math.random() * 5)),
    is_peak: base[i] >= 0.8,
  };
});

export default function AnalyticsPage() {
  const [demandData, setDemandData] = useState(MOCK_DEMAND);
  const [forecast, setForecast] = useState(null);
  const [currentHour] = useState(new Date().getHours());

  useEffect(() => {
    api.getDemand(RESTAURANT_ID, 24).then(data => {
      if (data.hourly) {
        setForecast(data);
        setDemandData(data.hourly.map(h => ({
          hour: `${h.hour < 10 ? '0' : ''}${h.hour}:00`,
          expected_orders: h.expected_orders,
          is_peak: h.is_peak,
        })));
      }
    }).catch(() => {});
  }, []);

  const peakHours = demandData.filter(h => h.is_peak).map(h => h.hour);
  const maxOrders = Math.max(...demandData.map(h => h.expected_orders));
  const avgOrders = Math.round(demandData.reduce((a, h) => a + h.expected_orders, 0) / demandData.length);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Demand Analytics</h1>
          <p className="text-muted text-sm">AI-powered order demand forecasting for the next 24 hours</p>
        </div>
        <span className="badge badge-primary">📈 AI Forecast</span>
      </div>

      {/* Alert Banner */}
      {forecast?.alert_message && (
        <div style={{
          background: 'rgba(255, 120, 50, 0.08)',
          border: '1px solid rgba(255, 120, 50, 0.3)',
          borderRadius: 12, padding: '16px 20px',
          marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span style={{ fontSize: 24 }}>⚡</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Demand Alert</div>
            <div className="text-sm text-muted">{forecast.alert_message}</div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card" style={{ '--stat-color': 'var(--primary)' }}>
          <div className="stat-value">{maxOrders}</div>
          <div className="stat-label">Peak Hour Orders</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--accent)' }}>
          <div className="stat-value">{avgOrders}</div>
          <div className="stat-label">Avg Hourly Orders</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--warning)' }}>
          <div className="stat-value">{peakHours.length}</div>
          <div className="stat-label">Peak Hours Today</div>
        </div>
      </div>

      {/* Demand Chart */}
      <div className="chart-container mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="card-title">24-Hour Demand Forecast</div>
          <div className="text-sm text-muted">
            Current: {`${currentHour < 10 ? '0' : ''}${currentHour}:00`}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={demandData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff7832" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#ff7832" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
            <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false} tickLine={false} interval={1}/>
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
            <Tooltip
              contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
              formatter={(v, name) => [`${v} orders`, 'Expected']}
            />
            <ReferenceLine x={`${currentHour < 10 ? '0' : ''}${currentHour}:00`}
              stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" label={{ value: 'Now', fill: 'var(--text-secondary)', fontSize: 11 }}/>
            <Area type="monotone" dataKey="expected_orders" stroke="#ff7832" strokeWidth={2}
              fill="url(#demandGrad)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Peak Hours Grid */}
      <div className="card">
        <div className="card-title mb-4">🔥 Peak Hour Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
          {demandData.map((h, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '12px 8px', borderRadius: 8,
              background: h.is_peak ? 'rgba(255, 120, 50, 0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${h.is_peak ? 'rgba(255,120,50,0.3)' : 'transparent'}`,
              transition: 'all 0.2s'
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{h.hour}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: h.is_peak ? 'var(--primary)' : 'var(--text-primary)' }}>
                {h.expected_orders}
              </div>
              {h.is_peak && <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 2 }}>⚡ Peak</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

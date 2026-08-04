import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { api } from '../utils/api';

const RESTAURANT_ID = 'demo-restaurant-1';

const MOCK_TRENDS = [
  { period: '2024-05', emotion_breakdown: { joy: 0.52, anger: 0.08, sadness: 0.10, neutral: 0.25, surprise: 0.05 }, avg_rating: 4.2, total_reviews: 48 },
  { period: '2024-06', emotion_breakdown: { joy: 0.58, anger: 0.06, sadness: 0.08, neutral: 0.22, surprise: 0.06 }, avg_rating: 4.4, total_reviews: 61 },
  { period: '2024-07', emotion_breakdown: { joy: 0.65, anger: 0.05, sadness: 0.06, neutral: 0.18, surprise: 0.06 }, avg_rating: 4.6, total_reviews: 74 },
];

// Sample negative reviews for drill-down
const NEGATIVE_REVIEWS = [
  { id: 'rev-1', customer: 'Arjun Sharma', emotion: 'anger', text: 'Order was 45 minutes late and food was cold.', orderId: 'ORD-019', date: '2024-07-12' },
  { id: 'rev-2', customer: 'Priya Nair', emotion: 'sadness', text: 'Dal Makhani tasted off today. Very disappointed.', orderId: 'ORD-023', date: '2024-07-14' },
  { id: 'rev-3', customer: 'Rohit Verma', emotion: 'anger', text: 'Delivery partner was rude. Wrong order delivered.', orderId: 'ORD-031', date: '2024-07-18' },
];

const EMOTION_COLORS = {
  joy: '#fbbf24', anger: '#ef4444', sadness: '#3b82f6',
  neutral: '#6b7280', surprise: '#a855f7', disgust: '#22c55e', fear: '#ec4899'
};
const EMOTION_EMOJIS = { joy: '😊', anger: '😠', sadness: '😢', neutral: '😐', surprise: '😲' };

export default function SentimentPage() {
  const [trends, setTrends] = useState(MOCK_TRENDS);
  const [selected, setSelected] = useState(MOCK_TRENDS[MOCK_TRENDS.length - 1]);
  const [showDrilldown, setShowDrilldown] = useState(false);
  const [drillEmotion, setDrillEmotion] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getSentimentTrends(RESTAURANT_ID).then(data => {
      if (data.length) { setTrends(data); setSelected(data[data.length - 1]); }
    }).catch(() => {});
  }, []);

  const pieData = Object.entries(selected.emotion_breakdown).map(([name, value]) => ({
    name, value: Math.round(value * 100)
  }));

  const radarData = Object.entries(selected.emotion_breakdown).map(([emotion, val]) => ({
    emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
    score: Math.round(val * 100)
  }));

  const barData = trends.map(t => ({
    period: t.period,
    joy: Math.round((t.emotion_breakdown.joy || 0) * 100),
    anger: Math.round((t.emotion_breakdown.anger || 0) * 100),
    sadness: Math.round((t.emotion_breakdown.sadness || 0) * 100),
    rating: t.avg_rating,
  }));

  const handleNegativeClick = (emotion) => {
    setDrillEmotion(emotion);
    setShowDrilldown(true);
  };

  const goToOrders = (orderId) => {
    navigate(`/orders?highlight=${orderId}`);
  };

  const filteredNegativeReviews = drillEmotion
    ? NEGATIVE_REVIEWS.filter(r => r.emotion === drillEmotion)
    : NEGATIVE_REVIEWS;

  const angerPct = Math.round((selected.emotion_breakdown.anger || 0) * 100);
  const sadnessPct = Math.round((selected.emotion_breakdown.sadness || 0) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
            Sentiment Insights
          </h1>
          <p className="text-muted text-sm mt-2">AI-powered emotion analysis of customer reviews</p>
        </div>
        <span className="badge badge-primary">🧠 AI Powered</span>
      </div>

      {/* Period Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {trends.map(t => (
          <button key={t.period}
            className={`btn ${selected.period === t.period ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setSelected(t)}>
            {t.period}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card" style={{ '--stat-color': '#fbbf24' }}>
          <div className="stat-value">{Math.round((selected.emotion_breakdown.joy || 0) * 100)}%</div>
          <div className="stat-label">😊 Joy / Happiness</div>
        </div>
        {/* Anger — clickable drill-down */}
        <div className="stat-card sentiment-drill-card" style={{ '--stat-color': '#ef4444' }}
          onClick={() => handleNegativeClick('anger')}
          title="Click to see negative reviews">
          <div className="stat-value" style={{ color: angerPct > 10 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {angerPct}%
          </div>
          <div className="stat-label">😠 Anger / Frustration</div>
          <a className="sentiment-link" style={{ marginTop: 6 }}>
            {angerPct > 10 ? '⚠️ View complaints →' : '→ View reviews'}
          </a>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--primary)' }}>
          <div className="stat-value">{selected.avg_rating}</div>
          <div className="stat-label">⭐ Avg Rating</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--accent)' }}>
          <div className="stat-value">{selected.total_reviews}</div>
          <div className="stat-label">💬 Total Reviews</div>
        </div>
      </div>

      {/* Negative Trend Alert */}
      {angerPct > 7 && (
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--danger)' }}>
                Negative Sentiment Alert
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {angerPct}% anger + {sadnessPct}% sadness detected in {selected.period}. Review flagged orders below.
              </div>
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => handleNegativeClick('anger')}>
            View Complaints
          </button>
        </div>
      )}

      {/* Emotion Breakdown + Trend Charts */}
      <div className="grid-2 mb-6">
        {/* Emotion Pie — rows are clickable for negative emotions */}
        <div className="chart-container">
          <div className="card-title mb-4">Emotion Breakdown</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={EMOTION_COLORS[entry.name] || '#888'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`}
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {pieData.map(d => (
                <div key={d.name}
                  onClick={() => ['anger', 'sadness', 'disgust', 'fear'].includes(d.name) && handleNegativeClick(d.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                    cursor: ['anger', 'sadness', 'disgust', 'fear'].includes(d.name) ? 'pointer' : 'default',
                    borderRadius: 6, padding: '3px 6px', transition: 'background 0.2s',
                  }}
                  className={['anger', 'sadness', 'disgust', 'fear'].includes(d.name) ? 'sentiment-negative-bar' : ''}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: EMOTION_COLORS[d.name], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize', flex: 1 }}>
                    {EMOTION_EMOJIS[d.name]} {d.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}%</span>
                  {['anger', 'sadness'].includes(d.name) && d.value > 7 && (
                    <span style={{ fontSize: 10, color: 'var(--primary)' }}>→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="chart-container">
          <div className="card-title mb-4">Emotion Trend Over Time</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="period" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Bar dataKey="joy" fill="#fbbf24" radius={[2, 2, 0, 0]} name="Joy" />
              <Bar dataKey="anger" fill="#ef4444" radius={[2, 2, 0, 0]} name="Anger"
                onClick={(data) => handleNegativeClick('anger')} style={{ cursor: 'pointer' }} />
              <Bar dataKey="sadness" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Sadness"
                onClick={() => handleNegativeClick('sadness')} style={{ cursor: 'pointer' }} />
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            💡 Click on anger or sadness bars to drill into the flagged reviews
          </p>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="chart-container mb-6">
        <div className="card-title mb-4">Emotion Radar — {selected.period}</div>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={100}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="emotion" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <Radar dataKey="score" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.18} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Drill-down Panel */}
      {showDrilldown && (
        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {drillEmotion === 'anger' ? '😠 Flagged Anger Reviews' : '😢 Sadness Reviews'} — {selected.period}
              </div>
              <div className="text-sm text-muted mt-2">Click an order ID to jump to the Orders page</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDrilldown(false)}>✕ Close</button>
          </div>

          {filteredNegativeReviews.map(rev => (
            <div key={rev.id} className="card" style={{ marginBottom: 10, padding: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`badge emotion-${rev.emotion}`}>{EMOTION_EMOJIS[rev.emotion]} {rev.emotion}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{rev.customer}</span>
                  <span className="text-xs text-muted">{rev.date}</span>
                </div>
                <button
                  id={`drill-order-${rev.orderId}`}
                  className="sentiment-link"
                  onClick={() => goToOrders(rev.orderId)}
                >
                  View Order {rev.orderId} →
                </button>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                "{rev.text}"
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

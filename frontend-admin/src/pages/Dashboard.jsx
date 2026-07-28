import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Users, Film, DollarSign, Coins, AlertTriangle, CreditCard, Wallet } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import api from '../services/api'

const PERIODS = ['Today', 'Weekly', 'Monthly', 'Annual', 'All']

// 9 cards: Total Revenue, Membership Revenue, Top-Up Revenue, Total Users, Active Subscriptions, Dramas Uploaded, Coins Earned, Coins Spent, Check-ins
const metricIcons = [DollarSign, CreditCard, Wallet, Users, CreditCard, Film, Coins, Coins, AlertTriangle]

const alerts = []

// Format date label for X axis based on period
function formatDateLabel(dateStr, period) {
  if (period === 'Annual') {
    // dateStr is YYYY-MM, return month name
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const parts = dateStr.split('-')
    if (parts.length >= 2) return MONTH_NAMES[parseInt(parts[1], 10) - 1] || dateStr
    return dateStr
  }
  if (period === 'All') {
    // dateStr is YYYY (year)
    return dateStr
  }
  // Default: day/month from YYYY-MM-DD
  const d = new Date(dateStr)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// Custom tooltip for revenue chart
function RevenueTooltip({ active, payload, label, period }) {
  if (!active || !payload?.length) return null
  // Detect if this is the current (partial) month label — it contains a space and digit e.g. "Jun 8"
  const isPartial = period === 'Annual' && /\w+ \d+/.test(label)
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 4 }}>
        {label}{isPartial ? ' (month to date)' : ''}
      </div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: 'var(--mono)' }}>₱{Number(p.value).toLocaleString('en-PH')}</span>
        </div>
      ))}
    </div>
  )
}

// Custom tooltip for top shows chart
function ShowsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

const BAR_COLORS = ['var(--accent)', 'var(--blue)', 'var(--green)', '#a78bfa', '#f472b6']

export default function Dashboard() {
  const [period, setPeriod] = useState('Today')
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [revenueChart, setRevenueChart] = useState([])
  const [topShows, setTopShows] = useState([])
  const [chartsLoading, setChartsLoading] = useState(true)

  useEffect(() => {
    fetchMetrics(period)
    fetchCharts(period)
  }, [period])

  async function fetchMetrics(selectedPeriod) {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(`/v1/admin/dashboard/metrics?period=${selectedPeriod}`)
      setMetrics(response.data.data?.metrics || [])
    } catch (err) {
      setError(err.response?.data?.message || err.message)
      setMetrics([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchCharts(selectedPeriod) {
    setChartsLoading(true)
    try {
      const [revRes, showsRes] = await Promise.all([
        api.get(`/v1/admin/dashboard/revenue-chart?period=${selectedPeriod}`),
        api.get(`/v1/admin/dashboard/top-shows?period=${selectedPeriod}`),
      ])
      setRevenueChart(revRes.data.data?.chartData || [])
      setTopShows(showsRes.data.data?.chartData || [])
    } catch (err) {
      setRevenueChart([])
      setTopShows([])
    } finally {
      setChartsLoading(false)
    }
  }

  return (
    <div className="page-enter">
      {/* Alerts */}
      {alerts.map((a, i) => (
        <div key={i} style={{
          display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:10,
          background: a.type==='error'?'var(--red-bg)':a.type==='warn'?'var(--amber-bg)':'var(--blue-bg)',
          border:`1px solid ${a.type==='error'?'rgba(255,92,106,0.25)':a.type==='warn'?'rgba(245,166,35,0.25)':'rgba(77,166,255,0.25)'}`,
          borderRadius:'var(--radius)', fontSize:12,
          color: a.type==='error'?'var(--red)':a.type==='warn'?'var(--amber)':'var(--blue)',
        }}>
          <AlertTriangle size={13}/>
          {a.msg}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto', fontSize:11 }}>Review</button>
        </div>
      ))}

      {/* Period filter */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div style={{ fontWeight:600, fontSize:14 }}>Platform overview</div>
        <div style={{ display:'flex', gap:6 }}>
          {PERIODS.map(p => (
            <button key={p} className={`btn btn-sm ${period===p?'btn-primary':'btn-ghost'}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', padding:'40px' }}>
          <div style={{ animation:'spin 1s linear infinite' }}>Loading...</div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{ padding:'20px', backgroundColor:'var(--red-bg)', borderRadius:'var(--radius)', color:'var(--red)', marginBottom:20 }}>
          Error: {error}
        </div>
      )}

      {/* Metrics grid */}
      {!loading && metrics.length > 0 && (() => {
        // Swap row 1 (Revenue, indices 0-2) with row 2 (Users/Subs/Dramas, indices 3-5)
        // New order: [3-5] Users row, [0-2] Revenue row, [6-8] Coins/Checkins row
        const reordered = [
          ...metrics.slice(3, 6),
          ...metrics.slice(0, 3),
          ...metrics.slice(6, 9),
        ]
        // Map reordered index back to original for icons
        const origIndexMap = [3,4,5, 0,1,2, 6,7,8]
        return (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            {reordered.map((m, i) => {
              const Icon = metricIcons[origIndexMap[i]] || Users
              const isHighlighted = i >= 3 // new rows 2 and 3 change with filters
              return (
                <div key={m.label} className="metric-card" style={{
                  display:'flex', flexDirection:'column', gap:4,
                  ...(i < 3 ? {
                    border: '1px solid rgba(220,20,60,0.5)',
                    boxShadow: '0 0 0 1px rgba(220,20,60,0.12), 0 2px 14px rgba(220,20,60,0.14)',
                    background: 'linear-gradient(135deg, rgba(220,20,60,0.09) 0%, rgba(180,20,40,0.06) 100%)',
                  } : isHighlighted ? {
                    border: '1px solid rgba(168,85,247,0.5)',
                    boxShadow: '0 0 0 1px rgba(168,85,247,0.12), 0 2px 14px rgba(168,85,247,0.14)',
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.09) 0%, rgba(99,102,241,0.06) 100%)',
                  } : {})
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div className="metric-label">{m.label}</div>
                    <div style={{
                      width:28, height:28, borderRadius:6,
                      background: i < 3 ? 'rgba(220,20,60,0.2)' : isHighlighted ? 'rgba(168,85,247,0.2)' : 'var(--bg4)',
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                    }}>
                      <Icon size={13} color={i < 3 ? '#f87171' : isHighlighted ? '#c084fc' : 'var(--text3)'}/>
                    </div>
                  </div>
                  <div className="metric-value" style={{ fontSize:20 }}>{m.value}</div>
                  <div className="metric-sub">
                    <span>{m.sub}</span>
                    {m.trend && (
                      <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:3, color:m.up===false?'var(--red)':m.up?'var(--green)':'var(--text3)', fontFamily:'var(--mono)', fontSize:11 }}>
                        {m.up===true?<TrendingUp size={10}/>:m.up===false?<TrendingDown size={10}/>:null}
                        {m.trend}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Empty state */}
      {!loading && metrics.length === 0 && !error && (
        <div style={{ padding:'40px', textAlign:'center', color:'var(--text3)' }}>
          No metrics available for this period
        </div>
      )}

      {/* Charts row */}
      {!loading && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:8 }}>

          {/* Revenue over time */}
          <div className="metric-card" style={{ padding:'16px 18px' }}>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:16, color:'var(--text)' }}>Revenue over time</div>
            {chartsLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:220, color:'var(--text3)', fontSize:12 }}>Loading...</div>
            ) : revenueChart.length === 0 ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:220, color:'var(--text3)', fontSize:12 }}>No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenueChart} margin={{ top:4, right:8, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey={period === 'Annual' || period === 'All' ? 'label' : 'date'}
                    tickFormatter={v => period === 'Annual' || period === 'All' ? v : formatDateLabel(v, period)}
                    tick={{ fontSize:10, fill:'var(--text3)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize:10, fill:'var(--text3)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v >= 1000 ? `₱${(v/1000).toFixed(0)}k` : `₱${v}`}
                    width={45}
                  />
                  <Tooltip content={<RevenueTooltip period={period} />} />
                  <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="membership" name="Membership" stroke="var(--green)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="topup" name="Top-Up" stroke="var(--blue)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top 5 shows by views — vertical bar chart */}
          <div className="metric-card" style={{ padding:'16px 18px' }}>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:16, color:'var(--text)' }}>Top shows by views</div>
            {chartsLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:220, color:'var(--text3)', fontSize:12 }}>Loading...</div>
            ) : topShows.length === 0 ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:220, color:'var(--text3)', fontSize:12 }}>No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topShows} margin={{ top:4, right:8, left:0, bottom:40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="show"
                    tick={{ fontSize:9, fill:'var(--text3)', angle:-25, textAnchor:'end' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tickFormatter={v => v.length > 10 ? v.slice(0, 10) + '…' : v}
                  />
                  <YAxis
                    tick={{ fontSize:10, fill:'var(--text3)' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip content={<ShowsTooltip />} />
                  <Bar dataKey="views" name="Views" radius={[3, 3, 0, 0]}>
                    {topShows.map((_, idx) => (
                      <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
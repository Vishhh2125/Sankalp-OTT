import { useState } from 'react'
import { Download } from 'lucide-react'

const PERIODS = ['Weekly', 'Monthly', 'Annual']
const REPORTS = ['subscription', 'drama', 'coins', 'users', 'churn', 'watchtime', 'content', 'revenue']

const reportData = {
  subscription: { title:'Subscription report', data:[{ lbl:'New subscriptions', val:'1,284', color:'var(--green)' },{ lbl:'Renewals', val:'8,910', color:'var(--text)' },{ lbl:'Cancellations', val:'412', color:'var(--red)' },{ lbl:'Total revenue', val:'₹4,21,380', color:'var(--accent2)' },{ lbl:'Weekly plan rev.', val:'₹62,290', color:'var(--text2)' },{ lbl:'Monthly plan rev.', val:'₹2,68,510', color:'var(--text2)' },{ lbl:'Annual plan rev.', val:'₹90,580', color:'var(--text2)' }] },
  drama:        { title:'Most watched dramas', data:[{ lbl:'Secret Marriage', val:'2.1M views', color:'var(--accent2)' },{ lbl:"CEO's Revenge", val:'1.7M views', color:'var(--accent2)' },{ lbl:'Lost in Seoul', val:'1.4M views', color:'var(--accent2)' },{ lbl:'Twin Flames', val:'800K views', color:'var(--text2)' },{ lbl:'Campus Crush', val:'640K views', color:'var(--text2)' }] },
  coins:        { title:'Coin usage report', data:[{ lbl:'Coins issued (gift)', val:'₵ 3,82,000', color:'var(--green)' },{ lbl:'Coins purchased', val:'₵ 1,24,500', color:'var(--blue)' },{ lbl:'Coins spent', val:'₵ 2,10,400', color:'var(--red)' },{ lbl:'Balance in wallets', val:'₵ 2,96,100', color:'var(--amber)' },{ lbl:'Referral coins', val:'₵ 14,200', color:'var(--text2)' }] },
  users:        { title:'User growth report', data:[{ lbl:'New signups', val:'3,210', color:'var(--green)' },{ lbl:'Free users', val:'30,450', color:'var(--text)' },{ lbl:'Paid users', val:'17,841', color:'var(--accent2)' },{ lbl:'Blocked users', val:'124', color:'var(--red)' }] },
  churn:        { title:'Churn rate report', data:[{ lbl:'Weekly churn', val:'0.8%', color:'var(--amber)' },{ lbl:'Monthly churn', val:'3.2%', color:'var(--amber)' },{ lbl:'Annual churn', val:'1.1%', color:'var(--green)' },{ lbl:'Avg churn', val:'1.7%', color:'var(--text2)' }] },
  watchtime:    { title:'Average watch time', data:[{ lbl:'All users / day', val:'22 min', color:'var(--text)' },{ lbl:'Paid users / day', val:'48 min', color:'var(--green)' },{ lbl:'Free users / day', val:'8 min', color:'var(--text2)' },{ lbl:'Peak hour', val:'9 PM – 11 PM', color:'var(--accent2)' }] },
  content:      { title:'Content unlock report', data:[{ lbl:'Episodes unlocked', val:'4,210', color:'var(--accent2)' },{ lbl:'Coins spent', val:'₵ 84,200', color:'var(--amber)' },{ lbl:'Top unlock ep.', val:'Secret Marriage Ep 4', color:'var(--text)' }] },
  revenue:      { title:'Revenue by plan', data:[{ lbl:'Weekly', val:'₹62,290', color:'var(--green)' },{ lbl:'Monthly', val:'₹2,68,510', color:'var(--accent2)' },{ lbl:'Annual', val:'₹90,580', color:'var(--amber)' },{ lbl:'Total', val:'₹4,21,380', color:'var(--text)' }] },
}

const topDramas = [
  { title:'Secret Marriage', views:'2.1M', pct:100 },
  { title:"CEO's Revenge",   views:'1.7M', pct:81 },
  { title:'Lost in Seoul',   views:'1.4M', pct:67 },
  { title:'Twin Flames',     views:'800K', pct:38 },
  { title:'Campus Crush',    views:'640K', pct:30 },
]

export default function Analytics() {
  const [period, setPeriod] = useState('Monthly')
  const [activeReport, setActiveReport] = useState('subscription')

  return (
    <div className="page-enter">
      {/* Metrics */}
      <div className="metrics-grid" style={{ marginBottom:20 }}>
        {[
          { label:'New subscribers', value:'1,284', sub:'+12% vs last month', color:'var(--green)' },
          { label:'Avg watch time',  value:'38 min', sub:'+4 min vs last month', color:'var(--blue)' },
          { label:'Churn rate',      value:'3.2%',  sub:'+0.4% this month', color:'var(--red)' },
          { label:'Coin redemption', value:'70%',   sub:'of earned coins spent', color:'var(--amber)' },
        ].map(m => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ color:m.color }}>{m.value}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Period + Export */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:6 }}>
          {PERIODS.map(p => (
            <button key={p} className={`btn btn-sm ${period===p?'btn-primary':'btn-ghost'}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm"><Download size={12}/> Export to CSV</button>
      </div>

      {/* Report selector + details */}
      <div className="grid2">
        <div className="card">
          <div className="card-title">Select report</div>
          {REPORTS.map(r => (
            <div key={r} onClick={() => setActiveReport(r)} style={{
              padding:'10px 12px', borderRadius:'var(--radius-sm)', marginBottom:4, cursor:'pointer',
              background:activeReport===r?'var(--accent-bg)':'transparent',
              border:`1px solid ${activeReport===r?'var(--accent-border)':'transparent'}`,
              color:activeReport===r?'var(--accent2)':'var(--text2)',
              fontSize:13, fontWeight:activeReport===r?600:400,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              {reportData[r].title}
              {activeReport===r && <span style={{ fontSize:10 }}>▶</span>}
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div className="card-title" style={{ marginBottom:0 }}>{reportData[activeReport].title}</div>
            <span className="badge badge-blue" style={{ fontSize:10 }}>{period}</span>
          </div>
          {reportData[activeReport].data.map(r => (
            <div key={r.lbl} className="stat-row">
              <span className="stat-lbl">{r.lbl}</span>
              <span className="stat-val" style={{ color:r.color }}>{r.val}</span>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ marginTop:14, width:'100%' }}><Download size={12}/> Download report</button>
        </div>
      </div>

      {/* Most watched bar chart */}
      <div className="card" style={{ marginTop:14 }}>
        <div className="card-title">Most watched dramas this {period.toLowerCase()}</div>
        {topDramas.map(d => (
          <div className="bar-row" key={d.title}>
            <div className="bar-lbl" style={{ width:150 }}>{d.title}</div>
            <div className="bar-track" style={{ flex:1 }}><div className="bar-fill" style={{ width:`${d.pct}%` }}/></div>
            <div className="bar-val">{d.views}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

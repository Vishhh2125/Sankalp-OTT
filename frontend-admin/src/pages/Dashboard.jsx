import { useState } from 'react'
import { TrendingUp, TrendingDown, Users, Film, DollarSign, Coins, AlertTriangle, CreditCard } from 'lucide-react'

const PERIODS = ['Daily', 'Weekly', 'Monthly']

const metrics = {
  Daily:   [{ label:'Total Users', value:'48,291', sub:'+124 today', trend:'+0.3%', up:true }, { label:'Active Subscriptions', value:'11,840', sub:'live subscriber count', trend:'+0.8%', up:true }, { label:'Revenue', value:'₹12,600', sub:'today', trend:'+4.2%', up:true }, { label:'Dramas Uploaded', value:'142', sub:'total on platform', trend:'', up:null }, { label:'Most Watched', value:'Secret Marriage', sub:'2.1M total views', trend:'', up:null }, { label:'Coins Earned', value:'₵ 38,200', sub:'issued today', trend:'+6%', up:true }, { label:'Coins Spent', value:'₵ 21,400', sub:'unlocked today', trend:'+2%', up:true }, { label:'Trending Category', value:'Romance', sub:'#1 engagement', trend:'', up:null }, { label:'Check-ins Today', value:'2,840', sub:'daily rewards claimed', trend:'+12%', up:true }],
  Weekly:  [{ label:'Total Users', value:'48,291', sub:'+842 this week', trend:'+1.8%', up:true }, { label:'Active Subscriptions', value:'11,840', sub:'live subscriber count', trend:'+5.2%', up:true }, { label:'Revenue', value:'₹88,200', sub:'this week', trend:'+12%', up:true }, { label:'Dramas Uploaded', value:'142', sub:'total on platform', trend:'+3 this week', up:null }, { label:'Most Watched', value:'Secret Marriage', sub:'2.1M total views', trend:'', up:null }, { label:'Coins Earned', value:'₵ 268K', sub:'issued this week', trend:'+8%', up:true }, { label:'Coins Spent', value:'₵ 150K', sub:'unlocked this week', trend:'+5%', up:true }, { label:'Trending Category', value:'Thriller', sub:'#1 this week', trend:'', up:null }, { label:'Check-ins', value:'18,200', sub:'this week', trend:'+8%', up:true }],
  Monthly: [{ label:'Total Users', value:'48,291', sub:'+3,210 this month', trend:'+7.1%', up:true }, { label:'Active Subscriptions', value:'11,840', sub:'live subscriber count', trend:'+8.4%', up:true }, { label:'Revenue', value:'₹4,21,380', sub:'this month', trend:'+14%', up:true }, { label:'Dramas Uploaded', value:'142', sub:'total on platform', trend:'+11 this month', up:null }, { label:'Most Watched', value:'Secret Marriage', sub:'2.1M total views', trend:'', up:null }, { label:'Coins Earned', value:'₵ 1.16M', sub:'issued this month', trend:'+10%', up:true }, { label:'Coins Spent', value:'₵ 650K', sub:'unlocked this month', trend:'+7%', up:true }, { label:'Trending Category', value:'Romance', sub:'#1 this month', trend:'', up:null }, { label:'Check-ins', value:'72,400', sub:'this month', trend:'+15%', up:true }],
}

const metricIcons = [Users, CreditCard, DollarSign, Film, Film, Coins, Coins, Film, AlertTriangle]

const topDramas = [
  { title:'Secret Marriage', views:'2.1M', pct:100, type:'Paid' },
  { title:"CEO's Revenge",   views:'1.7M', pct:81,  type:'Paid' },
  { title:'Lost in Seoul',   views:'1.4M', pct:67,  type:'Paid' },
  { title:'Campus Crush',    views:'640K', pct:30,  type:'Free' },
  { title:'Twin Flames',     views:'800K', pct:38,  type:'Paid' },
]

const categoryRankings = [
  { name:'Romance',  pct:88 }, { name:'Thriller', pct:72 },
  { name:'CEO',      pct:60 }, { name:'Comedy',   pct:48 },
  { name:'School',   pct:35 }, { name:'Action',   pct:28 },
]

const alerts = [
  { type:'warn', msg:'3 users flagged for suspicious activity' },
  { type:'error', msg:'12 failed payments need review' },
  { type:'info', msg:'Coin expiry batch job scheduled for Apr 10' },
]

export default function Dashboard() {
  const [period, setPeriod] = useState('Monthly')
  const data = metrics[period]

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

      {/* Metrics grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {data.map((m, i) => {
          const Icon = metricIcons[i]
          return (
            <div key={m.label} className="metric-card" style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div className="metric-label">{m.label}</div>
                <div style={{ width:28,height:28,borderRadius:6,background:'var(--bg4)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  <Icon size={13} color="var(--text3)"/>
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

      {/* Bottom grid */}
      <div className="grid2" style={{ gap:14 }}>
        {/* Top dramas */}
        <div className="card">
          <div className="card-title">Most watched dramas</div>
          {topDramas.map(d => (
            <div className="bar-row" key={d.title}>
              <div className="bar-lbl" style={{ width:130 }}>{d.title}</div>
              <div className="bar-track" style={{ flex:1 }}>
                <div className="bar-fill" style={{ width:`${d.pct}%` }}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div className="bar-val">{d.views}</div>
                <span className={`badge ${d.type==='Paid'?'badge-purple':'badge-amber'}`} style={{ fontSize:9 }}>{d.type}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Category engagement */}
        <div className="card">
          <div className="card-title">Category engagement rankings</div>
          {categoryRankings.map((c, i) => (
            <div className="bar-row" key={c.name}>
              <div style={{ width:16, fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>#{i+1}</div>
              <div className="bar-lbl" style={{ width:80 }}>{c.name}</div>
              <div className="bar-track" style={{ flex:1 }}>
                <div className="bar-fill" style={{ width:`${c.pct}%`, background:`hsl(${260-(i*30)},60%,60%)` }}/>
              </div>
              <div className="bar-val">{c.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Copy, Radio, Monitor, Smartphone, RefreshCw, Square, Users, Eye } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { ConfirmDialog } from '../components/ui/Controls.jsx'
import { liveApi } from '../services/api.js'
import { publishViaWhip, isWhipEnvironmentSupported } from '../utils/whipPublisher.js'

const STATUS_BADGE = {
  SCHEDULED: 'badge-gray',
  LIVE: 'badge-green',
  ENDED: 'badge-red',
}

function extractYoutubeVideoId(urlOrId) {
  if (!urlOrId) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Copy failed — select and copy manually')
    }
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" readOnly value={value} style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12 }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
          <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m ago`
}

function ViewerAvatar({ name }) {
  const letter = (name || 'G').charAt(0).toUpperCase()
  return (
    <div style={{
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: 'var(--primary)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 600,
      flexShrink: 0,
    }}>
      {letter}
    </div>
  )
}

function ViewerPanel({ viewers }) {
  if (!viewers || viewers.viewer_count === 0) {
    return (
      <div style={{
        marginTop: 12,
        padding: 12,
        background: 'var(--bg3)',
        borderRadius: 8,
        fontSize: 12,
        color: 'var(--text3)',
        textAlign: 'center',
      }}>
        <Eye size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
        No viewers yet
      </div>
    )
  }

  return (
    <div style={{
      marginTop: 12,
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg3)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        fontWeight: 600,
      }}>
        <Users size={13} />
        {viewers.viewer_count} viewer{viewers.viewer_count !== 1 ? 's' : ''} watching
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {viewers.viewers.map((v) => (
          <div
            key={v.session_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              fontSize: 12,
            }}
          >
            <ViewerAvatar name={v.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.name || 'Guest'}
              </div>
              <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                Joined {timeAgo(v.joined_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LiveStreaming() {
  const [streams, setStreams] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [goLiveError, setGoLiveError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [whipError, setWhipError] = useState(null)
  const [whipPublishing, setWhipPublishing] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(null)
  const [viewers, setViewers] = useState({ viewer_count: 0, viewers: [] })
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const whipRef = useRef(null)
  const whipSupported = isWhipEnvironmentSupported()

  const loadStreams = useCallback(async () => {
    try {
      const res = await liveApi.getAll()
      const list = res.data?.data || []
      setStreams(list)
      if (selected?.id) {
        const fresh = list.find((s) => s.id === selected.id)
        if (fresh) setSelected(fresh)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load streams')
    } finally {
      setLoading(false)
    }
  }, [selected?.id])

  useEffect(() => {
    loadStreams()
  }, [loadStreams])

  useEffect(() => {
    if (!selected?.id || selected.status === 'ENDED') return undefined
    const t = setInterval(async () => {
      try {
        const promises = [liveApi.getById(selected.id)]
        // Fetch viewers in parallel when stream is LIVE
        if (selected.status === 'LIVE') {
          promises.push(liveApi.getViewers(selected.id))
        }
        const results = await Promise.all(promises)
        if (results[0].data?.data) setSelected(results[0].data.data)
        if (results[1]?.data?.data) setViewers(results[1].data.data)
      } catch { /* ignore poll errors */ }
    }, 30000)
    return () => clearInterval(t)
  }, [selected?.id, selected?.status])

  // Reset viewers when selecting a different stream or when stream ends
  useEffect(() => {
    if (!selected?.id || selected.status !== 'LIVE') {
      setViewers({ viewer_count: 0, viewers: [] })
    }
  }, [selected?.id, selected?.status])

  const createStream = async () => {
    if (!title.trim()) return
    const yid = extractYoutubeVideoId(youtubeUrl)
    if (!yid) {
      alert('Invalid YouTube URL or ID')
      return
    }
    setSaving(true)
    setError(null)
    setGoLiveError(null)
    try {
      const res = await liveApi.create({
        title: title.trim(),
        youtube_video_id: yid,
        source_type: 'YOUTUBE',
      })
      const data = res.data?.data
      setModalOpen(false)
      setTitle('')
      setYoutubeUrl('')
      await loadStreams()
      if (data?.stream) {
        setSelected(data.stream)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create stream')
    } finally {
      setSaving(false)
    }
  }

  const handleGoLive = async () => {
    if (!selected?.id) return
    setError(null)
    setGoLiveError(null)
    try {
      const res = await liveApi.goLive(selected.id)
      if (res.data?.data) {
        setSelected(res.data.data)
      }
      await loadStreams()
    } catch (err) {
      setGoLiveError(err.response?.data?.message || 'Failed to start live stream')
    }
  }

  const selectStream = async (stream) => {
    setWhipError(null)
    setGoLiveError(null)
    setSelected(stream)
  }

  const startWhip = async (options = {}) => {
    const { screenShare = false } = options
    if (!selected?.whip_url && !selected?.stream_key) return
    setWhipError(null)
    setWhipPublishing(true)
    try {
      const whipUrl =
        selected.whip_url ||
        `${window.location.protocol}//${window.location.hostname}:8889/live/${selected.stream_key}/whip`
      const session = await publishViaWhip(whipUrl, { video: true, audio: true, screenShare })
      whipRef.current = session
      setIsScreenSharing(screenShare)

      if (screenShare) {
        session.onStop = () => {
          handleSwitchToCamera()
        }
      }

      await liveApi.markLive(selected.stream_key, 'webrtc')
      setSelected((current) => current?.id === selected.id
        ? {
            ...current,
            status: 'LIVE',
            source_protocol: 'WHIP',
            started_at: current.started_at || new Date().toISOString(),
          }
        : current)
      const res = await liveApi.getById(selected.id)
      if (res.data?.data) setSelected(res.data.data)
    } catch (err) {
      setWhipError(err.message || 'WHIP connection failed')
    } finally {
      setWhipPublishing(false)
    }
  }

  const stopWhip = async ({ markEnded = true } = {}) => {
    const streamKey = selected?.stream_key
    whipRef.current?.stop?.()
    whipRef.current = null
    setIsScreenSharing(false)
    if (markEnded && streamKey) {
      try {
        await liveApi.markEnded(streamKey)
        if (selected?.id) {
          const res = await liveApi.getById(selected.id)
          if (res.data?.data) setSelected(res.data.data)
        }
      } catch (err) {
        setWhipError(err.response?.data?.message || err.message || 'Failed to stop browser broadcast')
      }
    }
  }

  const handleSwitchToCamera = async () => {
    if (!whipRef.current) return
    setWhipPublishing(true)
    setWhipError(null)
    try {
      // 1. Get new camera/mic stream
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960, max: 960 },
          height: { ideal: 540, max: 960 }
        },
        audio: true,
      })

      const videoTrack = cameraStream.getVideoTracks()[0]
      const audioTrack = cameraStream.getAudioTracks()[0]

      // 2. Replace tracks in active peer connection
      await whipRef.current.replaceTracks(videoTrack, audioTrack)

      // 3. Stop old tracks to release resources
      const oldStream = whipRef.current.mediaStream
      oldStream.getTracks().forEach((t) => t.stop())
      if (whipRef.current.displayStream) {
        whipRef.current.displayStream.getTracks().forEach((t) => t.stop())
      }
      if (whipRef.current.micStream) {
        whipRef.current.micStream.getTracks().forEach((t) => t.stop())
      }
      if (whipRef.current.audioContext && whipRef.current.audioContext.state !== 'closed') {
        whipRef.current.audioContext.close().catch(() => {})
      }

      // 4. Update session references
      whipRef.current.mediaStream = cameraStream
      whipRef.current.displayStream = null
      whipRef.current.micStream = null
      whipRef.current.audioContext = null

      setIsScreenSharing(false)
    } catch (err) {
      setWhipError('Switching to camera failed: ' + err.message)
    } finally {
      setWhipPublishing(false)
    }
  }

  const handleSwitchToScreen = async () => {
    if (!whipRef.current) return
    setWhipPublishing(true)
    setWhipError(null)
    try {
      // 1. Get display media stream
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: 960 },
          height: { max: 960 }
        },
        audio: true,
      })

      // 2. Get microphone stream
      let micStream = null
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        })
      } catch (micErr) {
        console.warn('Microphone access failed for screen sharing switch, proceeding with screen audio only:', micErr)
      }

      // 3. Mix audio using Web Audio API
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const destination = audioCtx.createMediaStreamDestination()

      let displayHasAudio = displayStream.getAudioTracks().length > 0
      let micHasAudio = micStream && micStream.getAudioTracks().length > 0

      if (displayHasAudio) {
        const displaySource = audioCtx.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]]))
        displaySource.connect(destination)
      }

      if (micHasAudio) {
        const micSource = audioCtx.createMediaStreamSource(new MediaStream([micStream.getAudioTracks()[0]]))
        micSource.connect(destination)
      }

      const mixedStream = new MediaStream()
      displayStream.getVideoTracks().forEach((track) => mixedStream.addTrack(track))
      if (displayHasAudio || micHasAudio) {
        destination.stream.getAudioTracks().forEach((track) => mixedStream.addTrack(track))
      }

      const videoTrack = mixedStream.getVideoTracks()[0]
      const audioTrack = mixedStream.getAudioTracks()[0]

      // 4. Replace tracks in active peer connection
      await whipRef.current.replaceTracks(videoTrack, audioTrack)

      // 5. Setup native stop sharing listener
      videoTrack.onended = () => {
        handleSwitchToCamera()
      }

      // 6. Stop old camera stream tracks to release device
      const oldStream = whipRef.current.mediaStream
      oldStream.getTracks().forEach((t) => t.stop())

      // 7. Update session references
      whipRef.current.mediaStream = mixedStream
      whipRef.current.displayStream = displayStream
      whipRef.current.micStream = micStream
      whipRef.current.audioContext = audioCtx

      setIsScreenSharing(true)
    } catch (err) {
      setWhipError('Switching to screen sharing failed: ' + err.message)
    } finally {
      setWhipPublishing(false)
    }
  }

  const endStream = async (id) => {
    try {
      await stopWhip({ markEnded: false })
      await liveApi.end(id)
      setConfirmEnd(null)
      setSelected(null)
      await loadStreams()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to end stream')
    }
  }

  const ingest = selected?.rtmp_url
    ? { rtmp_url: selected.rtmp_url, stream_key: selected.stream_key }
    : null

  return (
    <div className="page-enter">
      {error && (
        <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgb(220,38,38)', color: 'rgb(220,38,38)', padding: '12px 16px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Live Streaming</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)' }}>
            YouTube Live Streaming — viewers watch via the mobile Live tab
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={loadStreams}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={14} /> Create stream</button>
        </div>
      </div>

      {selected?.source_type === 'MEDIAMTX' && !whipSupported && (
        <div className="card" style={{ padding: 12, marginBottom: 16, borderColor: 'var(--amber)', fontSize: 12 }}>
          <strong>HTTPS required for browser go-live.</strong> WHIP needs a secure context (HTTPS or localhost).
          Use OBS over RTMP on HTTP, or open the admin panel via HTTPS / Cloudflare.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>Streams</div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
          ) : streams.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No streams yet</div>
          ) : (
            streams.map((s) => (
              <div
                key={s.id}
                onClick={() => selectStream(s)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: selected?.id === s.id ? 'var(--bg3)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{s.title}</span>
                  <span className={`badge ${STATUS_BADGE[s.status] || 'badge-gray'}`}>{s.status}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {new Date(s.created_at).toLocaleString()}
                  {s.source_protocol ? ` · ${s.source_protocol}` : ''}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          {!selected ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 40 }}>
              Select a stream or create a new one
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{selected.title}</h3>
                  <span className={`badge ${STATUS_BADGE[selected.status]}`} style={{ marginTop: 6 }}>{selected.status}</span>
                </div>
                {selected.status !== 'ENDED' && (
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmEnd(selected)}>
                    <Square size={12} /> End stream
                  </button>
                )}
              </div>

              {selected.source_type === 'YOUTUBE' ? (
                <div style={{ marginTop: 12 }}>
                  <CopyField label="YouTube unlisted stream link" value={`https://www.youtube.com/watch?v=${selected.youtube_video_id}`} />
                  
                  {goLiveError && (
                    <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{goLiveError}</div>
                  )}

                  {selected.status === 'SCHEDULED' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleGoLive}
                      >
                        <Radio size={12} style={{ marginRight: 4 }} /> Go Live
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <ModalSection title={<><Monitor size={14} style={{ verticalAlign: -2, marginRight: 6 }} />OBS / RTMP</>}>
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                      In OBS: Settings → Stream → Custom. Server = RTMP URL, Stream key = key below.
                    </p>
                    <CopyField label="RTMP server" value={ingest?.rtmp_url || 'Create stream to get URL'} />
                    <CopyField label="Stream key" value={selected.stream_key || '—'} />
                  </ModalSection>

                  <ModalSection title={<><Smartphone size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Browser / WHIP</>}>
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                      Go live from this device with camera video. Browser live is video-only for mobile HLS compatibility.
                    </p>
                    {selected.whip_url && <CopyField label="WHIP endpoint" value={selected.whip_url} />}
                    {whipError && (
                      <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{whipError}</div>
                    )}
                    {selected.status !== 'ENDED' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {!whipRef.current ? (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={!whipSupported || whipPublishing || selected.status === 'ENDED'}
                              onClick={() => startWhip({ screenShare: false })}
                            >
                              <Radio size={12} style={{ marginRight: 4 }} /> {whipPublishing && !isScreenSharing ? 'Connecting…' : 'Go live (Camera)'}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={!whipSupported || whipPublishing || selected.status === 'ENDED'}
                              onClick={() => startWhip({ screenShare: true })}
                              style={{
                                background: 'var(--bg3)',
                                border: '1px solid var(--border)',
                                color: 'var(--text)'
                              }}
                            >
                              <Monitor size={12} style={{ marginRight: 4 }} /> {whipPublishing && isScreenSharing ? 'Connecting…' : 'Share screen'}
                            </button>
                          </>
                        ) : (
                          <>
                            {isScreenSharing ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={whipPublishing}
                                onClick={handleSwitchToCamera}
                                style={{
                                  background: 'var(--bg3)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text)'
                                }}
                              >
                                <Radio size={12} style={{ marginRight: 4 }} /> Switch to Camera
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={whipPublishing}
                                onClick={handleSwitchToScreen}
                                style={{
                                  background: 'var(--bg3)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text)'
                                }}
                              >
                                <Monitor size={12} style={{ marginRight: 4 }} /> Switch to Screen
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => stopWhip({ markEnded: false })}>Stop browser broadcast</button>
                          </>
                        )}
                      </div>
                    )}
                  </ModalSection>
                </>
              )}

              {selected.status === 'LIVE' && (
                <div style={{ marginTop: 12, padding: 10, background: 'rgba(76,175,80,0.12)', borderRadius: 8, fontSize: 12 }}>
                  <strong>Live now</strong> — viewers can watch in the app Live tab.
                  {selected.started_at && (
                    <span> Started {new Date(selected.started_at).toLocaleTimeString()}</span>
                  )}
                </div>
              )}

              {selected.status === 'LIVE' && (
                <ViewerPanel viewers={viewers} />
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create live stream"
        width={420}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={createStream} disabled={saving || !title.trim() || !extractYoutubeVideoId(youtubeUrl)}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <FormGroup label="Title *">
          <input className="input" placeholder="e.g. Friday night premiere" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
        </FormGroup>
        <FormGroup label="YouTube Link *">
          <input className="input" placeholder="e.g. https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} disabled={saving} />
          {youtubeUrl && extractYoutubeVideoId(youtubeUrl) && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>PREVIEW</div>
              <img src={`https://img.youtube.com/vi/${extractYoutubeVideoId(youtubeUrl)}/hqdefault.jpg`} style={{ width: 160, height: 90, borderRadius: 6, objectFit: 'cover' }} />
            </div>
          )}
        </FormGroup>
      </Modal>

      <ConfirmDialog
        open={!!confirmEnd}
        danger
        title="End stream"
        message={`End "${confirmEnd?.title}"? Viewers will no longer see it as live.`}
        onConfirm={() => endStream(confirmEnd.id)}
        onCancel={() => setConfirmEnd(null)}
      />
    </div>
  )
}

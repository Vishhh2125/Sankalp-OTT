import { useState, useEffect } from 'react'
import { Search, Loader, Filter, CheckCircle2, AlertCircle, FileText, ExternalLink, Calendar, User, Eye, Check } from 'lucide-react'
import Modal, { ModalSection, FormGroup } from '../components/ui/Modal.jsx'
import { courseworkApi } from '../services/api.js'
import { useDramas } from '../services/useDramas.js'

export default function Submissions() {
  const { dramas } = useDramas()

  // State lists & pagination
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(15)

  // Filters
  const [statusFilter, setStatusFilter] = useState('All') // 'All', 'SUBMITTED', 'GRADED'
  const [showFilter, setShowFilter] = useState('All') // 'All' or showId

  // Grading Modal
  const [gradeModalOpen, setGradeModalOpen] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)
  const [score, setScore] = useState('')
  const [letterGrade, setLetterGrade] = useState('GRADE_A')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch submissions from API
  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const params = {
        page,
        limit,
      }
      if (statusFilter !== 'All') params.status = statusFilter
      if (showFilter !== 'All') params.show_id = showFilter

      const res = await courseworkApi.getSubmissions(params)
      setSubmissions(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      console.error('Failed to load submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  // Reload when filters or page changes
  useEffect(() => {
    fetchSubmissions()
  }, [page, statusFilter, showFilter])

  // Reset page when filters change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value)
    setPage(1)
  }

  const handleShowFilterChange = (e) => {
    setShowFilter(e.target.value)
    setPage(1)
  }

  // Handle Letter Grade Change
  const handleLetterGradeChange = (val) => {
    setLetterGrade(val)
    const gradeScores = {
      GRADE_A: '95',
      GRADE_B: '85',
      GRADE_C: '75',
      GRADE_D: '65',
      GRADE_F: '50',
    }
    if (gradeScores[val]) {
      setScore(gradeScores[val])
    }
  }

  // Open grading modal
  const openGradingModal = (sub) => {
    setSelectedSub(sub)
    const subGrade = sub.letter_grade || (sub.score >= 90 ? 'GRADE_A' : sub.score >= 80 ? 'GRADE_B' : sub.score >= 70 ? 'GRADE_C' : sub.score >= 60 ? 'GRADE_D' : 'GRADE_F')
    setLetterGrade(subGrade)
    setScore(sub.score !== null ? sub.score.toString() : '95')
    setFeedback(sub.feedback || '')
    setGradeModalOpen(true)
  }

  // Save grade & feedback
  const handleSaveGrade = async () => {
    const parsedScore = parseInt(score, 10)
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      return alert('Please enter a valid score between 0 and 100')
    }

    setSaving(true)
    try {
      await courseworkApi.gradeSubmission(selectedSub.id, {
        score: parsedScore,
        letter_grade: letterGrade,
        feedback: feedback.trim() || null,
      })
      alert('Submission graded successfully!')
      setGradeModalOpen(false)
      fetchSubmissions()
    } catch (err) {
      alert('Failed to submit grade: ' + (err.response?.data?.message || err.message))
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{total} submissions total</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Review and grade student assignment files and answers
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="search-row" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text2)', fontSize: 13 }}>
          <Filter size={14} /> Filters:
        </div>

        {/* Show filter */}
        <select className="select" value={showFilter} onChange={handleShowFilterChange} style={{ minWidth: 180 }}>
          <option value="All">All Courses</option>
          {dramas.map(d => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>

        {/* Status filter */}
        <select className="select" value={statusFilter} onChange={handleStatusFilterChange} style={{ minWidth: 150 }}>
          <option value="All">All Statuses</option>
          <option value="SUBMITTED">Submitted (Pending)</option>
          <option value="GRADED">Graded</option>
        </select>
      </div>

      {/* Queue Grid / Card */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 10 }}>
            <Loader size={24} className="spin" style={{ color: 'var(--accent2)' }} />
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>Loading submissions queue...</span>
          </div>
        ) : submissions.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 20px', fontSize: 13 }}>
            No submissions found matching filters
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)' }}>
                  <th style={{ padding: '12px 20px' }}>Student</th>
                  <th style={{ padding: '12px 20px' }}>Assignment / Course</th>
                  <th style={{ padding: '12px 20px' }}>Submitted Date</th>
                  <th style={{ padding: '12px 20px' }}>Status</th>
                  <th style={{ padding: '12px 20px' }}>Score</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => {
                  const isGraded = sub.status === 'GRADED_PASSED' || sub.status === 'GRADED' || sub.status === 'NEEDS_REVISION'
                  const isPassed = sub.status === 'GRADED_PASSED' || sub.status === 'GRADED'
                  const isNeedsRevision = sub.status === 'NEEDS_REVISION'
                  const submitDate = new Date(sub.submitted_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                  const letterGradeText = sub.letter_grade ? sub.letter_grade.replace('GRADE_', 'Grade ') : null

                  return (
                    <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                      {/* Student info */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 16, background: 'var(--bg4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 600, color: 'var(--accent2)'
                          }}>
                            {sub.user?.name ? sub.user.name[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{sub.user?.name || 'Unknown student'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub.user?.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Course / Assignment info */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {sub.assignment?.title || 'Unknown Assignment'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          Course ID: {sub.assignment?.show_id?.slice(0, 8)}...
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={12} style={{ color: 'var(--text3)' }} />
                          {submitDate}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <span className={`badge ${isPassed ? 'badge-green' : isNeedsRevision ? 'badge-amber' : 'badge-blue'}`} style={{ fontSize: 10 }}>
                          {isPassed ? 'Approved (Passed)' : isNeedsRevision ? 'Needs Revision' : 'Submitted (Pending)'}
                        </span>
                      </td>

                      {/* Score */}
                      <td style={{ padding: '14px 20px', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
                        {isGraded ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: isPassed ? 'var(--green)' : 'var(--red)' }}>
                              {sub.score}/100
                            </span>
                            {letterGradeText && (
                              <span className={`badge ${isPassed ? 'badge-green' : 'badge-pink'}`} style={{ fontSize: 9 }}>
                                {letterGradeText}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)' }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <button
                          className={`btn btn-sm ${isGraded ? 'btn-ghost' : 'btn-primary'}`}
                          onClick={() => openGradingModal(sub)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}
                        >
                          {isGraded ? (
                            <>
                              <Eye size={12} /> View Details
                            </>
                          ) : (
                            <>
                              <Check size={12} /> Grade Task
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      )}

      {/* Grading Modal */}
      <Modal
        open={gradeModalOpen}
        onClose={() => setGradeModalOpen(false)}
        title={selectedSub?.status === 'GRADED' ? 'Review Grade & Submission' : 'Grade Submission'}
        width={680}
      >
        {selectedSub && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header info card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>STUDENT</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <User size={13} style={{ color: 'var(--accent2)' }} /> {selectedSub.user?.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{selectedSub.user?.email}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>ASSIGNMENT</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>{selectedSub.assignment?.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Submitted: {new Date(selectedSub.submitted_at).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Answer Text */}
            <ModalSection title="Submitted Answer Text">
              <div style={{
                background: 'var(--bg4)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: 13,
                color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: '1.5',
                minHeight: '80px', maxHeight: '200px', overflowY: 'auto'
              }}>
                {selectedSub.answer_text || (
                  <span style={{ fontStyle: 'italic', color: 'var(--text3)' }}>No description or text submitted.</span>
                )}
              </div>
            </ModalSection>

            {/* File Attachment */}
            {selectedSub.attachment_url && (
              <ModalSection title="File Attachment">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid var(--accent-border)', borderRadius: 8, padding: '10px 14px' }}>
                    <FileText size={18} style={{ color: 'var(--accent2)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedSub.attachment_url.split('/').pop()}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                        Click download button to inspect file details
                      </div>
                    </div>
                    <a
                      href={selectedSub.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px', fontSize: 11, color: 'var(--accent2)' }}
                    >
                      <ExternalLink size={11} /> Open
                    </a>
                  </div>

                  {/* Attachment image preview if it is PNG/JPG */}
                  {/\.(png|jpe?g)$/i.test(selectedSub.attachment_url) && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 240, background: 'var(--bg4)', display: 'flex', justifyContent: 'center' }}>
                      <img
                        src={selectedSub.attachment_url}
                        alt="Student upload preview"
                        style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', maxHeight: 240 }}
                      />
                    </div>
                  )}
                </div>
              </ModalSection>
            )}

            {/* Grade Input fields */}
            <ModalSection title="Grading & Evaluation" style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
              {selectedSub.status === 'GRADED' ? (
                // Readonly grade display
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      Evaluated on: {selectedSub.graded_at ? new Date(selectedSub.graded_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, background: 'var(--bg3)', borderRadius: 6, padding: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Score:</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{selectedSub.score} / 100</div>

                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Feedback:</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
                      {selectedSub.feedback || <span style={{ fontStyle: 'italic', color: 'var(--text3)' }}>No feedback comments recorded.</span>}
                    </div>
                  </div>
                </div>
              ) : (
                // Editable grade input form
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {selectedSub?.assignment?.min_passing_grade && (
                    <div style={{ fontSize: 11, background: 'var(--bg4)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Course Requirement:</span>
                      <span className="badge badge-blue" style={{ fontSize: 10 }}>
                        Min Grade Required: {selectedSub.assignment.min_passing_grade.replace('GRADE_', 'Grade ')}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                    <FormGroup label="Assign Letter Grade *">
                      <select
                        className="select"
                        value={letterGrade}
                        onChange={e => handleLetterGradeChange(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="GRADE_A">Grade A (90%+) — Approved (Passed)</option>
                        <option value="GRADE_B">Grade B (80%+) — Approved (Passed)</option>
                        <option value="GRADE_C">Grade C (70%+) — Approved (Passed)</option>
                        <option value="GRADE_D">Grade D (60%+) — Pass</option>
                        <option value="GRADE_F">Grade F (Below 60%) — Needs Revision</option>
                      </select>
                    </FormGroup>

                    <FormGroup label="Numeric Score (0-100) *">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="e.g. 85"
                        value={score}
                        onChange={e => setScore(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </FormGroup>
                  </div>

                  <FormGroup label="Feedback / Evaluation Comments">
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Provide constructive feedback for the student..."
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      style={{ width: '100%', resize: 'none' }}
                    />
                  </FormGroup>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                    <button className="btn btn-ghost" onClick={() => setGradeModalOpen(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSaveGrade} disabled={saving}>
                      {saving ? 'Submitting...' : 'Submit Evaluation'}
                    </button>
                  </div>
                </div>
              )}
            </ModalSection>
          </div>
        )}
      </Modal>
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react';
import { accountDeletionsApi } from '../services/api.js';

const REASON_OPTIONS = [
  'Not using the platform enough',
  'Found a better alternative',
  'Too expensive / membership cost',
  'Privacy or data concerns',
  'Course or content not relevant to me',
  'Technical issues / bugs',
  'Creating a new account',
  'Other',
];

export default function AccountDeletions() {
  const [items, setItems] = useState([]);
  const [reasonStats, setReasonStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await accountDeletionsApi.list({
        page,
        limit: 20,
        search: search.trim() || undefined,
        reason: reason || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      const responseData = res.data?.data || {};
      setItems(responseData.items || []);
      setPagination(responseData.pagination || { total: 0, totalPages: 1, limit: 20 });
      setReasonStats(responseData.reasonStats || {});
    } catch (err) {
      console.error('Failed to load account deletions:', err);
      setError(err.response?.data?.message || 'Failed to load account deletion audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, reason, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Determine top reason
  const topReasonEntry = Object.entries(reasonStats).sort((a, b) => b[1] - a[1])[0];
  const topReason = topReasonEntry ? `${topReasonEntry[0]} (${topReasonEntry[1]})` : 'N/A';

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      const params = {
        search: search.trim() || undefined,
        reason: reason || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const response = await accountDeletionsApi.exportCSV(params);
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `account_deletions_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export account deletions:', err);
      setError(err.response?.data?.message || 'Failed to export account deletion audit logs');
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setReason('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="account-deletions-page" style={{ padding: '24px' }}>
      {/* Header & Metrics Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--surface, #140018)', border: '1px solid var(--border, #2a2a32)' }}>
          <div style={{ fontSize: '13px', color: 'var(--textMuted, #8a8a9e)', marginBottom: '4px' }}>Total Account Deletions</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text, #fff)' }}>{pagination.total}</div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--surface, #140018)', border: '1px solid var(--border, #2a2a32)' }}>
          <div style={{ fontSize: '13px', color: 'var(--textMuted, #8a8a9e)', marginBottom: '4px' }}>Most Common Reason</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#ff4d4f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {topReason}
          </div>
        </div>
      </div>

      {/* Filter & Action Bar */}
      <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', background: 'var(--surface, #140018)', border: '1px solid var(--border, #2a2a32)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', flex: 1 }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search by name, email or suggestion..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border, #3a3a46)',
                background: 'var(--bg, #141418)',
                color: '#fff',
                fontSize: '14px',
                minWidth: '240px',
              }}
            />

            {/* Reason Selector */}
            <select
              value={reason}
              onChange={(e) => { setReason(e.target.value); setPage(1); }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border, #3a3a46)',
                background: 'var(--bg, #141418)',
                color: '#fff',
                fontSize: '14px',
              }}
            >
              <option value="">All Deletion Reasons</option>
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            {/* Date Range Filters */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border, #3a3a46)',
                background: 'var(--bg, #141418)',
                color: '#fff',
                fontSize: '14px',
              }}
              title="Start Date"
            />
            <span style={{ color: 'var(--textMuted, #8a8a9e)' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border, #3a3a46)',
                background: 'var(--bg, #141418)',
                color: '#fff',
                fontSize: '14px',
              }}
              title="End Date"
            />

            {(search || reason || startDate || endDate) && (
              <button
                onClick={handleResetFilters}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #ff4d4f',
                  background: 'transparent',
                  color: '#ff4d4f',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Export to CSV / Excel Button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              background: exporting ? '#2e7d32' : '#4CAF50',
              color: '#fff',
              fontWeight: '600',
              fontSize: '14px',
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.7 : 1,
              boxShadow: '0 2px 6px rgba(76,175,80,0.3)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? 'Exporting...' : 'Export to CSV / Excel'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,77,79,0.1)', border: '1px solid #ff4d4f', borderRadius: '8px', color: '#ff4d4f', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="card" style={{ borderRadius: '12px', background: 'var(--surface, #140018)', border: '1px solid var(--border, #2a2a32)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--textMuted, #8a8a9e)' }}>Loading account deletion records...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--textMuted, #8a8a9e)' }}>
            No account deletion audit records found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border, #2a2a32)' }}>
                  <th style={{ padding: '14px 16px', color: 'var(--textMuted, #8a8a9e)', fontWeight: '600' }}>User Name</th>
                  <th style={{ padding: '14px 16px', color: 'var(--textMuted, #8a8a9e)', fontWeight: '600' }}>Email Address</th>
                  <th style={{ padding: '14px 16px', color: 'var(--textMuted, #8a8a9e)', fontWeight: '600' }}>Reason Selected</th>
                  <th style={{ padding: '14px 16px', color: 'var(--textMuted, #8a8a9e)', fontWeight: '600' }}>Feedback / Suggestion</th>
                  <th style={{ padding: '14px 16px', color: 'var(--textMuted, #8a8a9e)', fontWeight: '600' }}>Date & Time Deleted</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border, #2a2a32)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '500', color: '#fff' }}>{row.user_name || 'N/A'}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--textMuted, #ccc)' }}>{row.user_email}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(255, 77, 79, 0.12)',
                        color: '#ff4d4f',
                        fontSize: '12px',
                        fontWeight: '600',
                        border: '1px solid rgba(255, 77, 79, 0.25)',
                      }}>
                        {row.reason}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--textMuted, #aaa)', maxWidth: '300px' }}>
                      {row.feedback ? row.feedback : <span style={{ fontStyle: 'italic', color: '#666' }}>No feedback provided</span>}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--textMuted, #ccc)', fontSize: '13px' }}>
                      {row.deleted_at ? new Date(row.deleted_at).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border, #2a2a32)' }}>
            <div style={{ fontSize: '13px', color: 'var(--textMuted, #8a8a9e)' }}>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total records)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #3a3a46)',
                  background: page <= 1 ? 'transparent' : 'var(--bg, #141418)',
                  color: page <= 1 ? '#555' : '#fff',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #3a3a46)',
                  background: page >= pagination.totalPages ? 'transparent' : 'var(--bg, #141418)',
                  color: page >= pagination.totalPages ? '#555' : '#fff',
                  cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Briefcase, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  Building2, 
  Search, 
  Trash2, 
  Clock, 
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t, language, tr} = useLanguage();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'employers' | 'jobs' | 'users'
  const [pendingEmployers, setPendingEmployers] = useState([]);
  const [allEmployers, setAllEmployers] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Reject Employer Modal state
  const [rejectingEmp, setRejectingEmp] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [pendingRes, employersRes, jobsRes, usersRes] = await Promise.all([
        api.get('/admin/pending-employers'),
        api.get('/admin/employers'),
        api.get('/admin/jobs'),
        api.get('/admin/users')
      ]);

      setPendingEmployers(pendingRes.employers || []);
      setAllEmployers(employersRes.employers || []);
      setAllJobs(jobsRes.jobs || []);
      setAllUsers(usersRes.users || []);
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Approve Employer
  const handleApproveEmployer = async (userId, companyName) => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/employers/${userId}/approve`);
      showNotification(language === 'rw' 
        ? `Ubucuruzi "${companyName}" bwemejwe. Ubu bushobora gushyiraho imirimo.` 
        : `Verified "${companyName}". The employer can now post jobs.`);
      await loadAllData();
    } catch (err) {
      alert(err.message || t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Decline Employer
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectingEmp) return;
    setActionLoading(true);
    try {
      await api.patch(`/admin/employers/${rejectingEmp.user_id}/reject`, { reason: rejectReason });
      setRejectingEmp(null);
      setRejectReason('');
      showNotification(language === 'rw' 
        ? `Ubusabe bwa "${rejectingEmp.company_name}" bwahakanywe.` 
        : `Declined verification for "${rejectingEmp.company_name}".`);
      await loadAllData();
    } catch (err) {
      alert(err.message || t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle user suspension
  const handleToggleUserStatus = async (targetUser) => {
    const nextStatus = targetUser.status === 'suspended' ? 'approved' : 'suspended';
    setActionLoading(true);
    try {
      await api.patch(`/admin/users/${targetUser.id}/status`, { status: nextStatus });
      await loadAllData();
    } catch (err) {
      alert(err.message || t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Remove Job
  const handleRemoveJob = async (jobId, title) => {
    if (!window.confirm(t('admin.removeJobConfirm'))) return;
    setActionLoading(true);
    try {
      await api.delete(`/admin/jobs/${jobId}`);
      showNotification(language === 'rw' ? `Umurimo "${title}" wakuweho.` : `Removed job "${title}".`);
      await loadAllData();
    } catch (err) {
      alert(err.message || t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-zinc-500 py-20 px-4">
        <div className="w-7 h-7 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 py-8 text-zinc-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Header */}
        <div className="pb-4 border-b border-zinc-200">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
            <ShieldCheck className="w-4 h-4 text-zinc-700" />
            <span>{t('nav.adminCenter')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            {t('admin.title')}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {t('admin.subtitle')}
          </p>
        </div>

        {/* Success Message Banner */}
        {successMsg && (
          <div className="p-3.5 bg-zinc-900 text-white rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <span>{t('admin.pendingApprovalsTab', { count: pendingEmployers.length })}</span>
            {pendingEmployers.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-zinc-950" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('employers')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'employers'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t('admin.approvedEmployersTab', { count: allEmployers.length })}
          </button>

          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'jobs'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t('admin.allJobsTab', { count: allJobs.length })}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t('admin.usersTab', { count: allUsers.length })}
          </button>
        </div>

        {/* Tab 1: Pending Employers Verification Queue */}
        {activeTab === 'pending' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            {pendingEmployers.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-zinc-900">
                  {t('admin.emptyPending')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {t('admin.emptyPendingDesc')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {pendingEmployers.map((emp) => (
                  <div key={emp.id} className="p-5 sm:p-6 hover:bg-zinc-50/50 transition space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-zinc-950">
                            {emp.company_name}
                          </h3>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                            {emp.industry || 'Business'}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span>{t('admin.contact')}: <strong className="text-zinc-800">{emp.contact_person || emp.name}</strong></span>
                          <span>•</span>
                          <span>{emp.email}</span>
                          <span>•</span>
                          <span>{emp.phone || 'No phone'}</span>
                          <span>•</span>
                          <span>{emp.location}</span>
                        </div>
                      </div>

                      {/* Approve / Decline Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleApproveEmployer(emp.user_id, emp.company_name)}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-50"
                        >
                          {t('admin.approveBtn')}
                        </button>
                        <button
                          onClick={() => setRejectingEmp(emp)}
                          disabled={actionLoading}
                          className="px-3.5 py-2 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium rounded-xl transition disabled:opacity-50"
                        >
                          {t('admin.rejectBtn')}
                        </button>
                      </div>
                    </div>

                    {/* Description & Verification Document */}
                    <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="text-zinc-600 max-w-xl">
                        <span className="text-zinc-400 block text-[10px] uppercase font-semibold">
                          {language === 'rw' ? 'Ibisobanuro by\'ubucuruzi' : 'Business Overview'}
                        </span>
                        <p className="mt-0.5">{emp.description || 'No description provided.'}</p>
                      </div>

                      {emp.registration_doc_url ? (
                        <a
                          href={emp.registration_doc_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-300 rounded-lg font-semibold text-zinc-900 hover:bg-zinc-50 shrink-0 shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{t('admin.viewDoc')}</span>
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </a>
                      ) : (
                        <span className="text-zinc-400 italic text-xs">{tr(tr("No registration file uploaded", "Nta dosiye y’iyandikisha yashyizweho"), "Nta dosiye y’iyandikisha yashyizweho")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Verified Employers */}
        {activeTab === 'employers' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {allEmployers.map((emp) => (
                <div key={emp.id} className="p-4 sm:p-5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-950 text-sm">{emp.company_name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {t('nav.statusApproved')}
                      </span>
                    </div>
                    <div className="text-zinc-500 mt-0.5 flex gap-3">
                      <span>{emp.industry}</span>
                      <span>•</span>
                      <span>{emp.location}</span>
                      <span>•</span>
                      <span>{emp.email}</span>
                    </div>
                  </div>
                  <span className="text-zinc-400 text-[11px]">
                    {new Date(emp.registered_at || emp.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Active Jobs Moderation */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {allJobs.map((job) => (
                <div key={job.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-950 text-sm">{job.title}</span>
                      <span className="text-zinc-400">at {job.company_name}</span>
                    </div>
                    <div className="text-zinc-500 mt-0.5 flex gap-3">
                      <span>{job.location}</span>
                      <span>•</span>
                      <span className="capitalize">{job.job_type}</span>
                      <span>•</span>
                      <span>{job.applicant_count || 0} applicants</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRemoveJob(job.id, job.title)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 hover:border-red-300 text-zinc-600 hover:text-red-600 rounded-lg text-xs font-medium transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('admin.removeJob')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: User Accounts */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {allUsers.map((u) => (
                <div key={u.id} className="p-4 sm:p-5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-950 text-sm">{u.name}</span>
                      <span className="capitalize text-zinc-500 font-medium">({u.role})</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        u.status === 'approved' 
                          ? 'bg-zinc-100 text-zinc-800' 
                          : u.status === 'suspended'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {u.status}
                      </span>
                    </div>
                    <div className="text-zinc-500 mt-0.5 flex gap-3">
                      <span>{u.email}</span>
                      {u.phone && <span>• {u.phone}</span>}
                      {u.national_id && <span>• NID: {u.national_id}</span>}
                    </div>
                  </div>

                  {u.role !== 'admin' && (
                    <button
                      onClick={() => handleToggleUserStatus(u)}
                      className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 rounded-lg text-xs font-medium text-zinc-700 transition"
                    >
                      {u.status === 'suspended' ? t('admin.activateUser') : t('admin.suspendUser')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Decline Reason Modal */}
      {rejectingEmp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-zinc-200">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-base font-bold text-zinc-950">
                {t('admin.rejectModalTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setRejectingEmp(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4 text-xs">
              <p className="text-zinc-600">
                {language === 'rw' 
                  ? `Sobanura impamvu ubusabe bwa "${rejectingEmp.company_name}" bwahakanywe:` 
                  : `Please specify the reason for declining "${rejectingEmp.company_name}":`}
              </p>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  {t('admin.rejectReasonLabel')}
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('admin.rejectReasonPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectingEmp(null)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {actionLoading ? t('common.loading') : t('admin.confirmRejectBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

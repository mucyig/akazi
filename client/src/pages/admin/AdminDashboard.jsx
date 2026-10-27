import { formatDate } from '../../utils/time';
import FileLink from '../../components/ProtectedFile';
import React, { useState, useEffect } from 'react';
import { 
  Flag,
  AlertTriangle,
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
  BadgeCheck,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatJobType } from '../../utils/format';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t, language, tr} = useLanguage();
  usePageTitle(tr("Admin Center", "Ubuyobozi Bukuru"));

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'employers' | 'jobs' | 'users'
  const [pendingEmployers, setPendingEmployers] = useState([]);
  const [allEmployers, setAllEmployers] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [reportFilter, setReportFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const pendingTickApplications = allEmployers.filter(e => e.verification_tick_status === 'applied');
  const pendingTickCount = pendingTickApplications.length;

  // Reject Employer Modal state
  const [rejectingEmp, setRejectingEmp] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleReportAction = async (reportId, status, takeDownJob = false) => {
    if (takeDownJob) {
      const ok = window.confirm(t('admin.takeDownConfirm') || 'Remove this job posting and mark report resolved?');
      if (!ok) return;
    }
    setActionLoading(true);
    try {
      await api.patch(`/admin/reports/${reportId}`, {
        status,
        take_down_job: takeDownJob,
      });
      setSuccessMsg(status === 'dismissed' ? 'Report dismissed.' : 'Report resolved successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to update report.');
    } finally {
      setActionLoading(false);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [pendingRes, employersRes, jobsRes, usersRes, reportsRes] = await Promise.all([
        api.get('/admin/pending-employers'),
        api.get('/admin/employers'),
        api.get('/admin/jobs'),
        api.get('/admin/users'),
        api.get('/admin/reports')
      ]);

      setPendingEmployers(pendingRes.employers || []);
      setAllEmployers(employersRes.employers || []);
      setAllJobs(jobsRes.jobs || []);
      setAllUsers(usersRes.users || []);
      setReports(reportsRes.reports || []);
      setPendingReportsCount(reportsRes.pending_count || 0);
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

  // Grant Verified Business Tick
  const handleGrantTick = async (empId, companyName) => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/employers/${empId}/grant-tick`);
      showNotification(language === 'rw' 
        ? `Ikimenyetso cy'ubucuruzi bwemejwe cyahawe "${companyName}".` 
        : `Granted Verified Business Tick to "${companyName}".`);
      await loadAllData();
    } catch (err) {
      alert(err.message || t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Decline Verified Business Tick
  const handleRejectTick = async (empId, companyName) => {
    const defaultReason = language === 'rw' 
      ? 'Inyandiko z\'iyandikisha ntizabashije kwemezwa.' 
      : 'Business verification documents could not be validated. Please ensure documents are valid.';
    const reason = window.prompt(
      language === 'rw' ? `Impamvu yo guhakanira "${companyName}":` : `Reason for declining verification tick for "${companyName}":`,
      defaultReason
    );
    if (!reason) return;
    setActionLoading(true);
    try {
      await api.patch(`/admin/employers/${empId}/reject-tick`, { reason });
      showNotification(language === 'rw' 
        ? `Ubusabe bwa "${companyName}" bwahakanywe.` 
        : `Declined verification tick for "${companyName}".`);
      await loadAllData();
    } catch (err) {
      alert(err.message || t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke Verified Business Tick
  const handleRevokeTick = async (empId, companyName) => {
    if (!window.confirm(language === 'rw' ? `Ushaka gukuraho ikimenyetso kuri "${companyName}"?` : `Revoke Verified Tick from "${companyName}"?`)) return;
    setActionLoading(true);
    try {
      await api.patch(`/admin/employers/${empId}/revoke-tick`);
      showNotification(language === 'rw' 
        ? `Ikimenyetso cyakuwe kuri "${companyName}".` 
        : `Revoked Verified Tick from "${companyName}".`);
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
            onClick={() => setActiveTab('ticks')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ticks'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>{language === 'rw' ? `Ubusabe bwa Verified Tick (${pendingTickCount})` : `Verified Tick Applications (${pendingTickCount})`}</span>
            {pendingTickCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white leading-none">
                {pendingTickCount}
              </span>
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
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'reports'
                ? 'border-red-600 text-red-600 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>{t('admin.reportsTab', { count: pendingReportsCount }) || `Reports (${pendingReportsCount})`}</span>
            {pendingReportsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white leading-none">
                {pendingReportsCount}
              </span>
            )}
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
                        <FileLink fileKey={emp.registration_doc_url} icon={false} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-300 rounded-lg font-semibold text-zinc-900 hover:bg-zinc-50 shrink-0 shadow-2xs">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{t('admin.viewDoc')}</span>
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </FileLink>
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

        {/* Tab: Verified Tick Applications Queue */}
        {activeTab === 'ticks' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <BadgeCheck className="w-5 h-5 text-blue-700 shrink-0" />
                <p className="text-blue-900 font-medium">
                  {language === 'rw' 
                    ? 'Abakoresha basabye ikimenyetso cy\'ubucuruzi bwemejwe (Verified Tick). Kanda kuri dosiye usuzume mbere yo kwemeza.' 
                    : 'Employers who applied for the official Verified Business Tick. Review their credentials and grant or decline the badge.'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
              {pendingTickApplications.length === 0 ? (
                <div className="p-12 text-center text-zinc-400 text-xs">
                  <BadgeCheck className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  <p className="font-semibold text-zinc-700">No pending verification tick applications.</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">When employers apply for the verified badge from their dashboard, they will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {pendingTickApplications.map((emp) => (
                    <div key={emp.id} className="p-5 sm:p-6 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-950 text-sm">{emp.company_name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Tick Applied
                            </span>
                          </div>
                          <div className="text-zinc-500 text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span>{emp.industry}</span>
                            <span>•</span>
                            <span>{emp.location}</span>
                            <span>•</span>
                            <span>{emp.email}</span>
                            {emp.phone && (
                              <>
                                <span>•</span>
                                <span>{emp.phone}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleGrantTick(emp.id, emp.company_name)}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <BadgeCheck className="w-3.5 h-3.5" />
                            <span>Grant Verified Tick</span>
                          </button>
                          <button
                            onClick={() => handleRejectTick(emp.id, emp.company_name)}
                            disabled={actionLoading}
                            className="px-3.5 py-2 border border-zinc-200 text-rose-600 hover:bg-rose-50 text-xs font-medium rounded-xl transition disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </div>

                      {/* Documents and Notes */}
                      <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="text-zinc-600 max-w-xl">
                          <span className="text-zinc-400 block text-[10px] uppercase font-semibold">
                            Notes / Submission Info
                          </span>
                          <p className="mt-0.5">{emp.verification_tick_notes || 'No extra notes provided.'}</p>
                        </div>

                        {(emp.verification_tick_doc_url || emp.registration_doc_url) ? (
                          <FileLink 
                            fileKey={emp.verification_tick_doc_url || emp.registration_doc_url} 
                            icon={false} 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-300 rounded-lg font-semibold text-zinc-900 hover:bg-zinc-50 shrink-0 shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>View Submitted Document</span>
                            <ExternalLink className="w-3 h-3 text-zinc-400" />
                          </FileLink>
                        ) : (
                          <span className="text-zinc-400 italic text-xs">No document attached</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Registered / Approved Employers */}
        {activeTab === 'employers' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {allEmployers.map((emp) => (
                <div key={emp.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-950 text-sm">{emp.company_name}</span>
                      
                      {/* Verified Tick Badge */}
                      {emp.is_verified ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          <BadgeCheck className="w-3 h-3 text-blue-600" />
                          <span>Verified Tick</span>
                        </span>
                      ) : emp.verification_tick_status === 'applied' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Tick Applied</span>
                        </span>
                      ) : null}

                      {/* Payment Status Badge */}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        emp.payment_status === 'paid' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {emp.payment_status === 'paid' ? 'Registration Paid' : 'Registration Unpaid'}
                      </span>
                    </div>

                    <div className="text-zinc-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{emp.industry}</span>
                      <span>•</span>
                      <span>{emp.location}</span>
                      <span>•</span>
                      <span>{emp.email}</span>
                      <span>•</span>
                      <span>{emp.job_count || 0} jobs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* View Document link if available */}
                    {(emp.verification_tick_doc_url || emp.registration_doc_url) && (
                      <FileLink
                        fileKey={emp.verification_tick_doc_url || emp.registration_doc_url}
                        icon={false}
                        className="px-2.5 py-1.5 text-[11px] font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-700 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Doc</span>
                      </FileLink>
                    )}

                    {/* Tick actions */}
                    {emp.is_verified ? (
                      <button
                        onClick={() => handleRevokeTick(emp.id, emp.company_name)}
                        disabled={actionLoading}
                        className="px-2.5 py-1.5 text-[11px] font-medium border border-zinc-200 hover:bg-zinc-50 text-zinc-600 rounded-lg transition disabled:opacity-50"
                      >
                        Revoke Tick
                      </button>
                    ) : emp.verification_tick_status === 'applied' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleGrantTick(emp.id, emp.company_name)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-2xs disabled:opacity-50"
                        >
                          Grant Tick
                        </button>
                        <button
                          onClick={() => handleRejectTick(emp.id, emp.company_name)}
                          disabled={actionLoading}
                          className="px-2.5 py-1.5 text-[11px] font-medium border border-zinc-200 text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGrantTick(emp.id, emp.company_name)}
                        disabled={actionLoading}
                        className="px-2.5 py-1.5 text-[11px] font-medium border border-zinc-200 hover:bg-blue-50 hover:text-blue-700 text-zinc-600 rounded-lg transition disabled:opacity-50"
                      >
                        Grant Tick
                      </button>
                    )}
                  </div>
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
                      <span className="text-zinc-400 inline-flex items-center gap-1">
                        at {job.company_name}
                        {job.is_verified && (
                          <BadgeCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 inline" title="Verified Business" />
                        )}
                      </span>
                    </div>
                    <div className="text-zinc-500 mt-0.5 flex gap-3">
                      <span>{job.location}</span>
                      <span>•</span>
                      <span>{formatJobType(job.job_type, language)}</span>
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
                      {u.gender && <span className="capitalize">• {u.gender}</span>}
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

        {/* Tab 5: Community Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                  <Flag className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-zinc-950 text-base">
                  {t('admin.emptyReports') || 'No reports found.'}
                </h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  {t('admin.emptyReportsDesc') || 'There are no active job reports from the community at this time.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
                <div className="divide-y divide-zinc-100">
                  {reports.map((rep) => {
                    const isPending = rep.status === 'pending';
                    return (
                      <div key={rep.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-zinc-50/50 transition">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                              rep.status === 'pending'
                                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                : rep.status === 'action_taken'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                            }`}>
                              {rep.status === 'pending' && <Clock className="w-3 h-3 text-amber-600" />}
                              {rep.status === 'action_taken' && <XCircle className="w-3 h-3 text-red-600" />}
                              {rep.status === 'dismissed' && <CheckCircle2 className="w-3 h-3 text-zinc-500" />}
                              <span>
                                {rep.status === 'pending' ? (t('admin.statusPending') || 'Pending Review') :
                                 rep.status === 'action_taken' ? (t('admin.statusActionTaken') || 'Job Removed') :
                                 (t('admin.statusDismissed') || 'Dismissed')}
                              </span>
                            </span>

                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                              <AlertTriangle className="w-3 h-3 text-red-500" />
                              <span>{t(`reportModal.reasons.${rep.reason}`) || rep.reason}</span>
                            </span>

                            <span className="text-xs text-zinc-400">
                              {rep.created_at ? formatDate(rep.created_at) : ''}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-zinc-950 text-sm">
                                {rep.job_title || `Job #${rep.job_id}`}
                              </span>
                              {rep.company_name && (
                                <span className="text-zinc-500 text-xs font-medium">
                                  at {rep.company_name}
                                </span>
                              )}
                              {rep.job_id && (
                                <a
                                  href={`/jobs/${rep.job_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                                >
                                  <span>View Job</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>

                            <p className="text-xs text-zinc-500 mt-0.5">
                              <span>Reporter: </span>
                              <span className="font-medium text-zinc-700">
                                {rep.reporter_name ? `${rep.reporter_name} (${rep.reporter_email || ''})` : 'Anonymous / Job Seeker'}
                              </span>
                              {rep.client_ip && <span className="text-zinc-400 ml-2">IP: {rep.client_ip}</span>}
                            </p>
                          </div>

                          {rep.details && (
                            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-700 leading-relaxed">
                              <span className="font-semibold text-zinc-900">{t('admin.reportDetails') || 'Details'}: </span>
                              <span>{rep.details}</span>
                            </div>
                          )}
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleReportAction(rep.id, 'dismissed')}
                              className="px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl transition disabled:opacity-50"
                            >
                              {t('admin.dismissReport') || 'Dismiss'}
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleReportAction(rep.id, 'action_taken', true)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t('admin.takeDownReportJob') || 'Remove Job'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

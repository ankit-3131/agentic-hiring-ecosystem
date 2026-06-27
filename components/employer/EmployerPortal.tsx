import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { API } from '../../lib/apiConfig';
import { useMessagingSocket } from '../../hooks/useMessagingSocket';
import { ChatPanel } from '../messaging/ChatPanel';
import type { ChatMessage } from '../../lib/chatTypes';
type Tab = 'jobs' | 'shortlist' | 'deepview' | 'chat' | 'analytics' | 'agency';

const STAGE_ORDER = ['applied', 'ai_screen', 'ai_interview', 'human_screening', 'offer'];
const STAGE_COLORS: Record<string, string> = {
  applied: 'bg-gray-400', ai_screen: 'bg-primary', ai_interview: 'bg-warning',
  human_screening: 'bg-blue-400', offer: 'bg-emerald-400', rejected: 'bg-destructive',
};

// Fixed workflow stages for all jobs
const WORKFLOW_STAGES = [
  { id: 'applied', label: 'Applied', type: 'ai' },
  { id: 'ai_screen', label: 'AI Screen', type: 'ai' },
  { id: 'ai_interview', label: 'AI Interview', type: 'ai' },
  { id: 'human_screening', label: 'Human Screening', type: 'human' },
  { id: 'offer', label: 'Offer', type: 'human' },
];

const Spinner = () => <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />;

const Badge = ({ text, color = 'bg-secondary/10 text-secondary border-secondary/20' }: { text: string; color?: string }) => (
  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${color}`}>{text}</span>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{children}</h4>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full bg-background/50 border border-border text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary transition ${props.className || ''}`} />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`w-full bg-background/50 border border-border text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary transition resize-none ${props.className || ''}`} />
);

const Btn = ({ children, onClick, disabled, variant = 'primary', className = '' }: any) => {
  const bases: Record<string, string> = {
    primary: 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30',
    solid: 'bg-primary text-black hover:bg-primary/90',
    outline: 'border border-border text-white hover:bg-white/5',
    danger: 'bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30',
    secondary: 'bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition disabled:opacity-40 flex items-center gap-2 ${bases[variant] || bases.primary} ${className}`}>
      {children}
    </button>
  );
};

// MAIN EMPLOYER PORTAL
const EmployerPortal: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('jobs');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedAppId, setSelectedAppId] = useState('');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'jobs', label: 'Job Agents' },
    { id: 'shortlist', label: 'Candidate Shortlist' },
    { id: 'deepview', label: 'Deep View' },
    { id: 'chat', label: 'Chat' },
    { id: 'analytics', label: 'Job Agent Analytics' },
    // { id: 'agency', label: 'Agency & HITL' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="w-2 h-8 bg-primary rounded-sm" />
        <h1 className="text-2xl md:text-3xl font-bold text-white">Employer Portal</h1>
        <Badge text={user?.name || 'Employer'} color="bg-primary/10 text-primary border-primary/20" />
        <button onClick={() => { setTab('jobs'); }} className="ml-auto text-xs border border-primary/30 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition font-bold">+ Post New Role</button>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-card/50 p-1 rounded-xl border border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-max px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${tab === t.id ? 'bg-primary text-black shadow' : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-in fade-in duration-300">
        {tab === 'jobs' && <JobsTab userId={user?.id || ''} userName={user?.name || ''} onSelectJob={(j) => { setSelectedJob(j); setTab('shortlist'); }} />}
        {tab === 'shortlist' && <ShortlistTab userId={user?.id || ''} selectedJob={selectedJob} onSelectJob={setSelectedJob} onDeepView={(id) => { setSelectedAppId(id); setTab('deepview'); }} onOpenChat={(id) => { setSelectedAppId(id); setTab('chat'); }} />}
        {tab === 'deepview' && <DeepViewTab userId={user?.id || ''} appId={selectedAppId} onOpenChat={(id) => { setSelectedAppId(id); setTab('chat'); }} />}
        {tab === 'chat' && <EmployerChatTab userId={user?.id || ''} selectedJob={selectedJob} onSelectJob={setSelectedJob} selectedAppId={selectedAppId} onSelectApp={setSelectedAppId} />}
        {tab === 'analytics' && <AnalyticsTab userId={user?.id || ''} />}
        {/* {tab === 'agency' && <AgencyTab userId={user?.id || ''} selectedJob={selectedJob} onSelectJob={setSelectedJob} />} */}
      </div>
    </div>
  );
};

// TAB 1 — JOB AGENTS
const JobsTab: React.FC<{ userId: string; userName: string; onSelectJob: (j: any) => void }> = ({ userId, userName, onSelectJob }) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', salary_min: '', salary_max: '', employment_type: 'Full-time' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch(`${API}/employer/jobs?employer_id=${userId}`).then(r => r.json()).catch(() => []);
    setJobs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${API}/employer/jobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, salary_min: parseFloat(form.salary_min) || 0, salary_max: parseFloat(form.salary_max) || 0, employer_id: userId, employer_name: userName }),
      });
      toast.success('Job agent created!');
      setCreating(false);
      setForm({ title: '', description: '', location: '', salary_min: '', salary_max: '', employment_type: 'Full-time' });
      load();
    } catch { toast.error('Failed to create job'); }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {creating && (
        <div className="glass-card p-6 border border-primary/30">
          <h3 className="text-base font-bold text-white mb-4">Post New Role (Job Agent spins up instantly)</h3>
          <form onSubmit={createJob} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Job Title *" />
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location / Remote" />
              <Input type="number" value={form.salary_min} onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))} placeholder="Salary Min (LPA)" />
              <Input type="number" value={form.salary_max} onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))} placeholder="Salary Max (LPA)" />
              <select className="w-full bg-background/50 border border-border text-white px-3 py-2 rounded-lg text-sm" value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}>
                {['Full-time', 'Part-time', 'Contract', 'Remote', 'Hybrid'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Textarea required rows={5} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Job Description (the AI uses this for matching) *" />
            <div className="flex gap-2">
              <Btn variant="solid" className="flex-1 justify-center" disabled={submitting}>{submitting ? <Spinner /> : '✓ Create Job Agent'}</Btn>
              <Btn variant="outline" onClick={() => setCreating(false)}>Cancel</Btn>
            </div>
          </form>
        </div>
      )}

      {!creating && (
        <button onClick={() => setCreating(true)} className="w-full border-2 border-dashed border-primary/30 text-primary rounded-xl p-4 hover:bg-primary/5 transition text-sm font-bold">
          + Post New Role → Instant Job Agent
        </button>
      )}

      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <div className="space-y-3">
          {jobs.map((job: any) => {
            const counts = job.stage_counts || {};
            const total = counts.total || 0;
            return (
              <div key={job.id} className="glass-card p-5 hover:border-primary/30 transition cursor-pointer" onClick={() => onSelectJob(job)}>
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-white text-base">{job.title}</h3>
                    <p className="text-xs text-muted-foreground">{job.location && `${job.location} · `}{job.employment_type} · {job.salary_min && job.salary_max ? `₹${job.salary_min}L–₹${job.salary_max}L · ` : ''}Posted {new Date(job.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge text={`${total} total`} color="bg-border text-white border-border" />
                    <Badge text={job.status} color={job.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-border text-muted-foreground border-border'} />
                  </div>
                </div>
                {/* Funnel mini */}
                <div className="flex gap-3 text-center text-xs">
                  {STAGE_ORDER.map(s => (
                    <div key={s} className="flex-1">
                      <div className="font-bold text-white text-sm">{counts[s] || 0}</div>
                      <div className="text-muted-foreground capitalize">{s}</div>
                    </div>
                  ))}
                  <div className="flex-1">
                    <div className="font-bold text-destructive text-sm">{counts.rejected || 0}</div>
                    <div className="text-muted-foreground">rejected</div>
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  {STAGE_ORDER.map(s => {
                    const pct = total > 0 ? ((counts[s] || 0) / total * 100) : 0;
                    return <div key={s} className={`h-1 rounded-full ${STAGE_COLORS[s]}`} style={{ width: `${Math.max(pct, 2)}%` }} />;
                  })}
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && <div className="text-center py-16 text-muted-foreground text-sm">No job agents yet. Post a role to get started.</div>}
        </div>
      )}
    </div>
  );
};


// TAB 2 — CANDIDATE SHORTLIST

const ShortlistTab: React.FC<{ userId: string; selectedJob: any; onSelectJob: (j: any) => void; onDeepView: (id: string) => void; onOpenChat: (id: string) => void }> = ({ userId, selectedJob, onSelectJob, onDeepView, onOpenChat }) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stagingId, setStagingId] = useState('');
  const [rejectId, setRejectId] = useState('');
  const [rejectMsg, setRejectMsg] = useState('');
  const [rejectingId, setRejectingId] = useState('');

  useEffect(() => {
    fetch(`${API}/employer/jobs?employer_id=${userId}`).then(r => r.json()).then(d => setJobs(Array.isArray(d) ? d : [])).catch(() => { });
  }, [userId]);

  useEffect(() => {
    if (!selectedJob) return;
    setLoading(true);
    fetch(`${API}/employer/jobs/${selectedJob.id}/shortlist`).then(r => r.json()).then(d => { setCandidates(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, [selectedJob]);

  const moveStage = async (appId: string, currentStage: string) => {
    const idx = STAGE_ORDER.indexOf(currentStage);
    const nextStage = idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : currentStage;
    if (nextStage === currentStage) return toast('Already at final stage');
    setStagingId(appId);
    await fetch(`${API}/employer/applications/${appId}/stage`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: nextStage, note: 'Moved by employer' }),
    });
    setCandidates(c => c.map(x => x.application_id === appId ? { ...x, stage: nextStage } : x));
    setStagingId('');
    toast.success(`Moved to ${nextStage}`);
  };

  const doReject = async () => {
    if (!rejectMsg.trim() || !rejectId) return;
    setRejectingId(rejectId);
    await fetch(`${API}/employer/applications/${rejectId}/reject?employer_id=${userId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: rejectMsg }),
    });
    setCandidates(c => c.filter(x => x.application_id !== rejectId));
    setRejectId('');
    setRejectMsg('');
    setRejectingId('');
    toast.success('Application rejected & candidate notified');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Job picker */}
      <div className="glass-card p-4 space-y-2 lg:col-span-1 overflow-y-auto max-h-[70vh]">
        <SectionTitle>Select Role</SectionTitle>
        {jobs.map(j => (
          <button key={j.id} onClick={() => onSelectJob(j)} className={`w-full text-left p-3 rounded-lg border text-sm transition ${selectedJob?.id === j.id ? 'border-primary/50 bg-primary/5 text-white' : 'border-border text-muted-foreground hover:bg-white/5'}`}>
            <div className="font-medium text-white">{j.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{j.stage_counts?.total || 0} candidates</div>
          </button>
        ))}
      </div>

      {/* Candidate list */}
      <div className="lg:col-span-3 space-y-3">
        {!selectedJob ? (
          <div className="glass-card p-12 text-center text-muted-foreground">Select a role to view shortlisted candidates.</div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-white">{selectedJob.title} — Top {candidates.length} Candidates</h2>
              {loading && <Spinner />}
            </div>
            {candidates.map((c: any, rank: number) => (
              <div key={c.application_id} className="glass-card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-black text-primary flex-shrink-0">
                    #{rank + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white">{c.name}</p>
                      <Badge text={`${c.match_score}/100`} color="bg-primary/10 text-primary border-primary/20" />
                      <Badge text={c.stage} color={c.stage === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-secondary/10 text-secondary border-secondary/20'} />
                      {c.gap_score !== null && <Badge text={`Interview: ${c.gap_score}/100`} color="bg-warning/10 text-warning border-warning/20" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.location && `${c.location} · `}{c.experience_years > 0 && `${c.experience_years} yrs · `}{c.email}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Btn variant="outline" onClick={() => onDeepView(c.application_id)} className="text-xs">Deep View</Btn>
                    <Btn variant="secondary" onClick={() => onOpenChat(c.application_id)} className="text-xs">Chat</Btn>
                    <Btn variant="primary" onClick={() => moveStage(c.application_id, c.stage)} disabled={stagingId === c.application_id || c.stage === 'offer'} className="text-xs">
                      {stagingId === c.application_id ? <Spinner /> : '→ Next Stage'}
                    </Btn>
                    <Btn variant="danger" onClick={() => setRejectId(c.application_id)} className="text-xs">Reject</Btn>
                  </div>
                </div>

                {/* Skills */}
                {c.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.skills.slice(0, 8).map((s: string) => (
                      <span key={s} className="px-2 py-0.5 text-xs bg-secondary/10 border border-secondary/20 text-secondary rounded-full">{s}</span>
                    ))}
                  </div>
                )}

                {/* Inline reject panel */}
                {rejectId === c.application_id && (
                  <div className="p-3 border border-destructive/30 bg-destructive/5 rounded-lg space-y-2">
                    <p className="text-xs text-destructive font-bold">Reject & Notify Candidate</p>
                    <Textarea rows={3} value={rejectMsg} onChange={e => setRejectMsg(e.target.value)} placeholder="Write a rejection message (candidate will receive this in their inbox with your name)…" />
                    <div className="flex gap-2">
                      <Btn variant="danger" onClick={doReject} disabled={!rejectMsg.trim() || rejectingId === c.application_id} className="text-xs">
                        {rejectingId === c.application_id ? <Spinner /> : 'Confirm Reject & Notify'}
                      </Btn>
                      <Btn variant="outline" onClick={() => { setRejectId(''); setRejectMsg(''); }} className="text-xs">Cancel</Btn>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {candidates.length === 0 && !loading && (
              <div className="glass-card p-12 text-center text-muted-foreground">No candidates yet. Candidates who apply will appear here ranked by match score.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

function sortChronoMsgs(msgs: ChatMessage[]): ChatMessage[] {
  return [...msgs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizeEmployerMsg(m: any): ChatMessage {
  return {
    id: String(m.id),
    application_id: m.application_id,
    from_id: m.from_id || '',
    from_name: m.from_name || '',
    to_id: m.to_id,
    content: m.content || '',
    msg_type: m.msg_type || 'message',
    type: m.msg_type || 'message',
    timestamp: m.timestamp || '',
    read: m.read ?? false,
  };
}


// TAB 3 — CANDIDATE DEEP VIEW

const DeepViewTab: React.FC<{ userId: string; appId: string; onOpenChat: (id: string) => void }> = ({ userId, appId, onOpenChat }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stepUpdating, setStepUpdating] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [overrideScore, setOverrideScore] = useState<number | ''>('');
  const [overrideRecommendation, setOverrideRecommendation] = useState<string>('hold');
  const [overrideStage, setOverrideStage] = useState<string>('human_screening');
  const [overrideNote, setOverrideNote] = useState<string>('');

  useEffect(() => {
    if (!appId) return;
    setLoading(true);
    fetch(`${API}/employer/candidate/${appId}`).then(r => r.json()).then((d) => {
      setData(d);
      const latestReport = d?.latest_ai_interview_report;
      const app = d?.application || {};
      const score = app?.interview_score ?? app?.ai_score ?? latestReport?.overall_score ?? null;
      setOverrideScore(typeof score === 'number' ? score : '');
      setOverrideRecommendation(app?.recommendation ?? latestReport?.recommendation ?? 'hold');
      setOverrideStage(app?.stage ?? 'human_screening');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [appId]);

  const toggleStep = async (stepId: string, completed: boolean) => {
    setStepUpdating(stepId);
    await fetch(`${API}/employer/applications/${appId}/complete-step`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_id: stepId, completed }),
    });
    setData((d: any) => ({
      ...d,
      application: {
        ...d.application,
        completed_steps: completed
          ? [...(d.application.completed_steps || []), stepId]
          : (d.application.completed_steps || []).filter((s: string) => s !== stepId),
      },
    }));
    setStepUpdating('');
  };

  const refreshDeepView = async (nextAppId: string) => {
    const d = await fetch(`${API}/employer/candidate/${nextAppId}`).then(r => r.json()).catch(() => null);
    if (d) {
      setData(d);
      const latestReport = d?.latest_ai_interview_report;
      const app = d?.application || {};
      const score = app?.interview_score ?? app?.ai_score ?? latestReport?.overall_score ?? null;
      setOverrideScore(typeof score === 'number' ? score : '');
      setOverrideRecommendation(app?.recommendation ?? latestReport?.recommendation ?? 'hold');
      setOverrideStage(app?.stage ?? 'human_screening');
    }
  };

  const applyAiInterviewOverride = async () => {
    if (!appId) return;
    setOverriding(true);
    try {
      const payload: any = {};
      if (typeof overrideScore === 'number') payload.score = overrideScore;
      if (overrideRecommendation) payload.recommendation = overrideRecommendation;
      if (overrideStage) payload.stage = overrideStage;
      if (overrideNote.trim()) payload.note = overrideNote.trim();
      await fetch(`${API}/employer/applications/${appId}/ai-interview/override?employer_id=${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast.success('AI Interview override saved');
      await refreshDeepView(appId);
      setOverrideNote('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save override');
    }
    setOverriding(false);
  };

  if (!appId) return <div className="glass-card p-12 text-center text-muted-foreground">Select a candidate from the Shortlist tab first.</div>;
  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!data) return <div className="glass-card p-12 text-center text-muted-foreground">No data found.</div>;

  const { candidate, profile, application, interview_sessions } = data;
  const workflowSteps = WORKFLOW_STAGES;
  const completedSteps = application?.completed_steps || [];
  const session = interview_sessions?.[0];
  const latestReport = data?.latest_ai_interview_report;
  const overrideAudits = Array.isArray(data?.ai_interview_override_audits) ? data.ai_interview_override_audits : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Candidate info */}
      <div className="space-y-4">
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-black text-primary">
              {candidate.name?.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-white">{candidate.name}</p>
              <p className="text-xs text-muted-foreground">{candidate.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {profile.current_role && <div><span className="text-muted-foreground">Role: </span><span className="text-white">{profile.current_role}</span></div>}
            {profile.experience_years > 0 && <div><span className="text-muted-foreground">Exp: </span><span className="text-white">{profile.experience_years} yrs</span></div>}
            {profile.location && <div><span className="text-muted-foreground">Location: </span><span className="text-white">{profile.location}</span></div>}
            {profile.notice_period && <div><span className="text-muted-foreground">Notice: </span><span className="text-white">{profile.notice_period}</span></div>}
            {profile.salary_min && profile.salary_max && <div className="col-span-2"><span className="text-muted-foreground">Salary: </span><span className="text-white">₹{profile.salary_min}L–₹{profile.salary_max}L</span></div>}
          </div>
          {profile.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((s: string) => (
                <span key={s} className="px-2 py-0.5 text-xs bg-secondary/10 border border-secondary/20 text-secondary rounded-full">{s}</span>
              ))}
            </div>
          )}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Match Score</span>
            <span className="text-lg font-black text-primary">{application.match_score}/100</span>
          </div>
          <Btn variant="secondary" onClick={() => onOpenChat(appId)} className="w-full justify-center">
            Open Dedicated Chat
          </Btn>
        </div>

        {/* Workflow steps progress */}
        {workflowSteps.length > 0 && (
          <div className="glass-card p-5 space-y-2">
            <SectionTitle>Workflow Progress</SectionTitle>
            {workflowSteps.map((step: any) => {
              const done = completedSteps.includes(step.id);
              return (
                <div key={step.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                  <button
                    onClick={() => toggleStep(step.id, !done)}
                    disabled={stepUpdating === step.id}
                    className={`w-5 h-5 rounded flex-shrink-0 border flex items-center justify-center transition ${done ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    {done && <span className="text-black text-xs font-bold">✓</span>}
                    {stepUpdating === step.id && <Spinner />}
                  </button>
                  <span className={`text-sm ${done ? 'text-primary line-through opacity-60' : 'text-white'}`}>{step.label}</span>
                  <Badge text={step.type} color="bg-border text-muted-foreground border-border ml-auto" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Middle: AI interview */}
      <div className="space-y-4">
        <div className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-start gap-3">
            <SectionTitle>AI Interview Evaluation</SectionTitle>
            {latestReport ? (
              <Badge text={`${latestReport.overall_score}/100`} color="bg-warning/10 text-warning border-warning/20" />
            ) : session ? (
              <Badge text={`${session.gap_score}/100`} color="bg-warning/10 text-warning border-warning/20" />
            ) : (
              <Badge text="No data" />
            )}
          </div>

          {latestReport ? (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3 bg-background/50 border border-border rounded-lg text-xs text-white/80">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Recommendation</span>
                    <Badge
                      text={`AI: ${String(latestReport.recommendation || 'hold').toUpperCase()}`}
                      color="bg-secondary/10 text-secondary border-secondary/20"
                    />
                  </div>
                  <p>{latestReport.recommendation_reasoning || ''}</p>
                </div>

                {latestReport.dimension_scores ? (
                  <div className="space-y-3">
                    {[
                      { k: 'communication_clarity', label: 'Communication clarity' },
                      { k: 'technical_depth', label: 'Technical depth' },
                      { k: 'problem_solving_approach', label: 'Problem-solving' },
                      { k: 'cultural_signals', label: 'Cultural signals' },
                    ].map((d: any) => {
                      const v = Math.max(0, Math.min(100, Number(latestReport.dimension_scores?.[d.k] ?? 0)));
                      return (
                        <div key={d.k}>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{d.label}</span>
                            <span className="text-white font-medium">{v}/100</span>
                          </div>
                          <div className="h-2 bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${v}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {Array.isArray(latestReport.notable_quotes) && latestReport.notable_quotes.length > 0 && (
                  <div className="space-y-2">
                    <SectionTitle>Notable Quotes</SectionTitle>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {latestReport.notable_quotes.map((q: any, i: number) => (
                        <div key={i} className="p-3 bg-background/50 border border-border rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge text={q.dimension ? String(q.dimension).replace(/_/g, ' ') : 'quote'} color="bg-primary/10 text-primary border-primary/20" />
                          </div>
                          <p className="text-sm text-white font-medium">"{q.quote}"</p>
                          {q.why_it_matters ? <p className="text-xs text-muted-foreground mt-2">{q.why_it_matters}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(latestReport.transcript) && latestReport.transcript.length > 0 && (
                  <div className="space-y-2">
                    <SectionTitle>Transcript</SectionTitle>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {latestReport.transcript.map((t: any, i: number) => (
                        <div key={i} className="p-3 bg-background/50 border border-border rounded-lg">
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Q{i + 1}</p>
                            <p className="text-xs text-muted-foreground">{t.timestamp ? new Date(t.timestamp).toLocaleString() : ''}</p>
                          </div>
                          <p className="text-sm text-secondary font-semibold mb-2">{t.question}</p>
                          <p className="text-xs text-muted-foreground mb-1">Answer</p>
                          <p className="text-sm text-white whitespace-pre-wrap">{t.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : session ? (
            <>
              <div className="p-3 bg-background/50 border border-border rounded-lg text-xs text-white/80">
                {session.status === 'in_progress'
                  ? 'Candidate is currently doing the interview…'
                  : (session.overall_feedback || '—')}
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {session.reviews?.map((r: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border text-xs ${r.correct ? 'border-primary/20 bg-primary/5' : 'border-destructive/20 bg-destructive/5'}`}>
                    <p className="font-semibold text-white mb-1">Q{i + 1}: {r.question}</p>
                    <p className="text-white/60 mb-2 italic">"{r.answer}"</p>
                    <p className="text-white/80">{r.review}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="glass-card p-5 text-center text-muted-foreground text-sm">
              <div className="text-3xl mb-2">🎙</div>No interview session yet.
            </div>
          )}

          {/* Employer HITL override */}
          <div className="space-y-3 pt-2 border-t border-border">
            <SectionTitle>Employer Override (HITL)</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Override score</label>
                <Input
                  type="number"
                  value={overrideScore}
                  onChange={e => setOverrideScore(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="0-100"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Recommendation</label>
                <select
                  className="w-full bg-background/50 border border-border text-white px-3 py-2 rounded-lg text-sm"
                  value={overrideRecommendation}
                  onChange={e => setOverrideRecommendation(e.target.value)}
                >
                  <option value="hold">hold</option>
                  <option value="advance">advance</option>
                  <option value="pass">pass</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Pipeline stage</label>
                <select
                  className="w-full bg-background/50 border border-border text-white px-3 py-2 rounded-lg text-sm"
                  value={overrideStage}
                  onChange={e => setOverrideStage(e.target.value)}
                >
                  <option value="rejected">rejected</option>
                  <option value="ai_interview">ai_interview</option>
                  <option value="human_screening">human_screening</option>
                  <option value="offer">offer</option>
                  {STAGE_ORDER.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Override note (audit)</label>
              <Textarea rows={2} value={overrideNote} onChange={e => setOverrideNote(e.target.value)} placeholder="Why did you override the AI decision?" />
            </div>
            <div className="flex gap-2">
              <Btn onClick={applyAiInterviewOverride} disabled={overriding} className="w-full justify-center">
                {overriding ? <><Spinner /> Saving…</> : 'Save Override'}
              </Btn>
              <Btn
                onClick={() => {
                  setOverrideNote('');
                }}
                variant="outline"
                className="w-full justify-center"
              >
                Clear note
              </Btn>
            </div>
          </div>

          {overrideAudits.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <SectionTitle>Override Audit Log</SectionTitle>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {overrideAudits.map((a: any) => (
                  <div key={a.id} className="p-3 bg-background/50 border border-border rounded-lg">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-xs font-bold text-white/90">Score: {a.before?.interview_score} → {a.after?.interview_score}</p>
                        <p className="text-xs font-bold text-white/90">Rec: {String(a.before?.recommendation || '-')} → {String(a.after?.recommendation || '-')}</p>
                        <p className="text-xs font-bold text-white/90">Stage: {String(a.before?.stage || '-')} → {String(a.after?.stage || '-')}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}</p>
                    </div>
                    {a.note ? <p className="text-xs text-muted-foreground mt-2">Note: {a.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Match Feedback */}
        {application.feedback && (
          <div className="glass-card p-5 space-y-2">
            <SectionTitle>AI Resume Match</SectionTitle>
            <p className="text-xs text-muted-foreground"><strong className="text-white">Strengths: </strong>{application.feedback.strengths}</p>
            <p className="text-xs text-muted-foreground"><strong className="text-white">Weaknesses: </strong>{application.feedback.weaknesses}</p>
            <p className="text-xs text-muted-foreground"><strong className="text-white">Reasoning: </strong>{application.feedback.reasoning}</p>
          </div>
        )}
      </div>

    </div>
  );
};


// TAB 4 — ANALYTICS

const EmployerChatTab: React.FC<{ userId: string; selectedJob: any; onSelectJob: (j: any) => void; selectedAppId: string; onSelectApp: (id: string) => void }> = ({ userId, selectedJob, onSelectJob, selectedAppId, onSelectApp }) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [msgType, setMsgType] = useState('message');

  useEffect(() => {
    setLoadingJobs(true);
    fetch(`${API}/employer/jobs?employer_id=${userId}`).then(r => r.json()).then((d) => {
      const nextJobs = Array.isArray(d) ? d : [];
      setJobs(nextJobs);
      if (!selectedJob && nextJobs.length > 0) {
        onSelectJob(nextJobs[0]);
      }
      setLoadingJobs(false);
    }).catch(() => setLoadingJobs(false));
  }, [userId, onSelectJob, selectedJob]);

  useEffect(() => {
    if (!selectedJob?.id) {
      setCandidates([]);
      return;
    }
    setLoadingCandidates(true);
    fetch(`${API}/employer/jobs/${selectedJob.id}/shortlist`).then(r => r.json()).then((d) => {
      const nextCandidates = Array.isArray(d) ? d : [];
      setCandidates(nextCandidates);
      if (!nextCandidates.some((c: any) => c.application_id === selectedAppId)) {
        onSelectApp(nextCandidates[0]?.application_id || '');
      }
      setLoadingCandidates(false);
    }).catch(() => setLoadingCandidates(false));
  }, [selectedAppId, selectedJob, onSelectApp]);

  const loadMessages = useCallback(async (applicationId: string) => {
    if (!applicationId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    try {
      const response = await fetch(`${API}/employer/applications/${applicationId}/messages`);
      const data = await response.json();
      setMessages(sortChronoMsgs((Array.isArray(data) ? data : []).map(normalizeEmployerMsg)));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadMessages(selectedAppId);
  }, [selectedAppId, loadMessages]);

  const onSocketMessage = useCallback(
    (incoming: ChatMessage) => {
      if (incoming.application_id !== selectedAppId) return;
      setMessages(prev => {
        if (prev.some(x => x.id === incoming.id)) return prev;
        return sortChronoMsgs([...prev, normalizeEmployerMsg(incoming)]);
      });
    },
    [selectedAppId]
  );

  const { connected } = useMessagingSocket({
    userId,
    applicationId: selectedAppId || null,
    enabled: !!userId && !!selectedAppId,
    onMessage: onSocketMessage,
  });

  const sendMsg = async (text: string) => {
    if (!text.trim() || !selectedAppId) return;
    setSending(true);
    try {
      const response = await fetch(`${API}/employer/applications/${selectedAppId}/message?employer_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, msg_type: msgType }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Failed to send message');
      }
      toast.success('Message sent');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const selectedCandidate = candidates.find((c: any) => c.application_id === selectedAppId);
  const chatSubtitle = selectedCandidate
    ? `${selectedCandidate.name}${selectedJob?.title ? ` · ${selectedJob.title}` : ''}`
    : (selectedJob?.title || 'Candidate conversation');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[620px]">
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-card p-4 space-y-2 max-h-[28vh] overflow-y-auto">
          <SectionTitle>Select Role</SectionTitle>
          {loadingJobs && <div className="flex justify-center py-6"><Spinner /></div>}
          {!loadingJobs && jobs.map((job: any) => (
            <button
              key={job.id}
              onClick={() => onSelectJob(job)}
              className={`w-full text-left p-3 rounded-lg border text-sm transition ${selectedJob?.id === job.id ? 'border-primary/50 bg-primary/5 text-white' : 'border-border text-muted-foreground hover:bg-white/5'}`}
            >
              <div className="font-medium text-white">{job.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{job.stage_counts?.total || 0} candidates</div>
            </button>
          ))}
        </div>

        <div className="glass-card p-4 space-y-2 max-h-[52vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <SectionTitle>Conversations</SectionTitle>
            {connected && <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/90">Live</span>}
          </div>
          {loadingCandidates && <div className="flex justify-center py-10"><Spinner /></div>}
          {!loadingCandidates && candidates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">No candidate threads for this role yet.</p>
          )}
          {!loadingCandidates && candidates.map((candidate: any) => (
            <button
              key={candidate.application_id}
              type="button"
              onClick={() => onSelectApp(candidate.application_id)}
              className={`w-full text-left p-3.5 rounded-xl border transition ${selectedAppId === candidate.application_id ? 'border-secondary/50 bg-secondary/10 shadow-md shadow-secondary/5' : 'border-border/60 hover:bg-white/5 hover:border-border'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white truncate">{candidate.name}</p>
                <Badge text={candidate.stage} color={candidate.stage === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-secondary/10 text-secondary border-secondary/20'} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">{candidate.email}</p>
              <div className="flex gap-2 mt-2">
                <Badge text={`${candidate.match_score}/100`} color="bg-primary/10 text-primary border-primary/20" />
                {candidate.gap_score !== null && <Badge text={`Interview ${candidate.gap_score}/100`} color="bg-warning/10 text-warning border-warning/20" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-3 min-h-0">
        {!selectedAppId ? (
          <div className="flex h-full min-h-[620px] items-center justify-center glass-card border border-dashed border-border/60 bg-card/30 rounded-2xl">
            <div className="text-center text-muted-foreground px-6">
              <p className="text-sm font-medium text-white/80 mb-1">Select a conversation</p>
              <p className="text-xs">Choose a candidate thread to read and reply in real time.</p>
            </div>
          </div>
        ) : loadingMessages ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <ChatPanel
            className="h-[70vh]"
            messages={messages}
            currentUserId={userId}
            title="Communication"
            subtitle={chatSubtitle}
            connected={connected}
            onSend={sendMsg}
            sending={sending}
            placeholder="Type a message… (Enter to send)"
            emptyHint="No messages yet. Your notes to the candidate appear here."
            showMsgTypeSelect
            msgType={msgType}
            onMsgTypeChange={setMsgType}
            compact
          />
        )}
      </div>
    </div>
  );
};

const AnalyticsTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/employer/analytics/${userId}`).then(r => r.json()).then(d => { setAnalytics(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const totals = analytics.reduce((acc: any, job: any) => {
    const sc = job.stage_counts || {};
    STAGE_ORDER.forEach(s => { acc[s] = (acc[s] || 0) + (sc[s] || 0); });
    acc.rejected = (acc.rejected || 0) + (sc.rejected || 0);
    acc.total = (acc.total || 0) + (sc.total || 0);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Roles', value: analytics.filter(j => j.status === 'active').length, color: 'text-primary' },
          { label: 'Total Candidates', value: totals.total || 0, color: 'text-white' },
          { label: 'In Interview', value: totals.interview || 0, color: 'text-warning' },
          { label: 'Offers Made', value: totals.offer || 0, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="glass-card p-5 text-center">
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Per-job funnel */}
      <div className="space-y-4">
        {analytics.map((job: any) => {
          const sc = job.stage_counts || {};
          const total = sc.total || 1;
          return (
            <div key={job.job_id} className="glass-card p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-white">{job.job_title}</h3>
                <Badge text={job.status} color={job.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-border text-muted-foreground border-border'} />
              </div>

              {/* Funnel visual */}
              <div className="space-y-2">
                {[...STAGE_ORDER, 'rejected'].map(stage => {
                  const count = sc[stage] || 0;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={stage} className="flex items-center gap-3 text-sm">
                      <span className="w-20 text-xs text-muted-foreground capitalize text-right">{stage}</span>
                      <div className="flex-1 h-6 bg-border/30 rounded-lg overflow-hidden">
                        <div
                          className={`h-full rounded-lg flex items-center px-2 text-xs font-bold text-black transition-all duration-700 ${STAGE_COLORS[stage] || 'bg-secondary'}`}
                          style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                        >
                          {count > 0 && count}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                <span>Total: <strong className="text-white">{sc.total || 0}</strong></span>
                <span>Conversion to offer: <strong className="text-primary">{total > 0 ? Math.round(((sc.offer || 0) / total) * 100) : 0}%</strong></span>
                <span>Rejection rate: <strong className="text-destructive">{total > 0 ? Math.round(((sc.rejected || 0) / total) * 100) : 0}%</strong></span>
              </div>
            </div>
          );
        })}
        {analytics.length === 0 && <div className="glass-card p-12 text-center text-muted-foreground">Post jobs and receive applications to see analytics.</div>}
      </div>
    </div>
  );
};

// 
// // TAB 5 — AGENCY & HITL
// 
// const AgencyTab: React.FC<{ userId: string; selectedJob: any; onSelectJob: (j: any) => void }> = ({ userId, selectedJob, onSelectJob }) => {
//   const [jobs, setJobs] = useState<any[]>([]);
//   const [form, setForm] = useState({ agency_name: '', agency_scope: '', hitl_steps: [] as string[] });
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     fetch(`${API}/employer/jobs?employer_id=${userId}`).then(r => r.json()).then(d => setJobs(Array.isArray(d) ? d : [])).catch(() => { });
//   }, [userId]);

//   useEffect(() => {
//     if (selectedJob) {
//       setForm({
//         agency_name: selectedJob.agency_name || '',
//         agency_scope: selectedJob.agency_scope || '',
//         hitl_steps: selectedJob.hitl_steps || [],
//       });
//     }
//   }, [selectedJob]);

//   const save = async () => {
//     if (!selectedJob) return;
//     setSaving(true);
//     await fetch(`${API}/employer/jobs/${selectedJob.id}/agency`, {
//       method: 'PUT', headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(form),
//     });
//     setSaving(false);
//     toast.success('Agency settings saved!');
//   };

//   const toggleHitlStep = (stepId: string) => {
//     setForm(f => ({
//       ...f,
//       hitl_steps: f.hitl_steps.includes(stepId)
//         ? f.hitl_steps.filter((s: string) => s !== stepId)
//         : [...f.hitl_steps, stepId],
//     }));
//   };

//   return (
//     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//       <div className="glass-card p-4 space-y-2">
//         <SectionTitle>Select Role</SectionTitle>
//         {jobs.map(j => (
//           <button key={j.id} onClick={() => onSelectJob(j)} className={`w-full text-left p-3 rounded-lg border text-sm transition ${selectedJob?.id === j.id ? 'border-primary/50 bg-primary/5 text-white' : 'border-border text-muted-foreground hover:bg-white/5'}`}>
//             {j.title}
//             {j.agency_name && <span className="ml-2 text-xs text-warning">Agency: {j.agency_name}</span>}
//           </button>
//         ))}
//       </div>

//       <div className="lg:col-span-2 space-y-4">
//         {!selectedJob ? (
//           <div className="glass-card p-12 text-center text-muted-foreground">Select a role to configure agency settings.</div>
//         ) : (
//           <div className="glass-card p-6 space-y-5">
//             <h3 className="font-bold text-white">Agency Management — {selectedJob.title}</h3>

//             <div className="space-y-3">
//               <div>
//                 <label className="text-xs text-muted-foreground mb-1 block">Agency Name</label>
//                 <Input value={form.agency_name} onChange={e => setForm(f => ({ ...f, agency_name: e.target.value }))} placeholder="e.g. TalentFirst Recruiting" />
//               </div>
//               <div>
//                 <label className="text-xs text-muted-foreground mb-1 block">Scope / Instructions for Agency</label>
//                 <Textarea rows={4} value={form.agency_scope} onChange={e => setForm(f => ({ ...f, agency_scope: e.target.value }))} placeholder="Describe what the agency is responsible for: sourcing, screening, coordination…" />
//               </div>
//             </div>

//             {WORKFLOW_STAGES?.length > 0 && (
//               <div>
//                 <SectionTitle>HITL — Human-In-The-Loop Steps</SectionTitle>
//                 <p className="text-xs text-muted-foreground mb-3">Toggle which workflow steps require human approval before the AI moves the candidate forward.</p>
//                 <div className="space-y-2">
//                   {WORKFLOW_STAGES.map((step: any) => {
//                     const active = form.hitl_steps.includes(step.id);
//                     return (
//                       <div key={step.id} className="flex items-center justify-between p-3 bg-background/30 border border-border rounded-lg">
//                         <div>
//                           <span className="text-sm text-white">{step.label}</span>
//                           <Badge text={step.type} color="bg-border text-muted-foreground border-border ml-2" />
//                         </div>
//                         <button
//                           onClick={() => toggleHitlStep(step.id)}
//                           className={`relative w-10 h-5 rounded-full transition-colors ${active ? 'bg-warning' : 'bg-border'}`}
//                         >
//                           <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
//                         </button>
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             )}

//             <Btn variant="solid" onClick={save} disabled={saving} className="w-full justify-center">
//               {saving ? <><Spinner /> Saving…</> : '✓ Save Agency Settings'}
//             </Btn>
//           </div>
//         )}
//       </div>
//     </div>
// );
// };

export default EmployerPortal;

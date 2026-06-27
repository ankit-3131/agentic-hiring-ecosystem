import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { API } from '../../lib/apiConfig';
import { useMessagingSocket } from '../../hooks/useMessagingSocket';
import { ChatPanel } from '../messaging/ChatPanel';
import type { ChatMessage } from '../../lib/chatTypes';
type Tab = 'dashboard' | 'jobs' | 'applications' | 'interview' | 'profile' | 'messages';

type RefreshProps = {
  refreshKey: number;
  onRefresh?: () => void;
};

const STAGES = ['applied', 'ai_screen', 'ai_interview', 'human_screening', 'offer'];
const STAGE_COLORS: Record<string, string> = {
  applied: 'bg-gray-400', ai_screen: 'bg-primary', ai_interview: 'bg-warning',
  human_screening: 'bg-blue-400', offer: 'bg-emerald-400', rejected: 'bg-destructive', withdrawn: 'bg-gray-500',
};
const LEVEL_COLORS: Record<string, string> = {
  None: 'bg-destructive', Basic: 'bg-orange-500', Moderate: 'bg-warning',
  Strong: 'bg-primary', Expert: 'bg-emerald-400',
};
const LEVEL_WIDTH: Record<string, string> = {
  None: 'w-0', Basic: 'w-1/4', Moderate: 'w-1/2', Strong: 'w-3/4', Expert: 'w-full',
};

// ─── Small components ─────────────────────────────────────
const Badge = ({ text, color = 'bg-secondary/10 text-secondary border-secondary/20' }: { text: string; color?: string }) => (
  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${color}`}>{text}</span>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{children}</h3>
);

const Spinner = () => (
  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full bg-background/50 border border-border text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-secondary transition ${props.className || ''}`} />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`w-full bg-background/50 border border-border text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-secondary transition resize-none ${props.className || ''}`} />
);

const Btn = ({ children, onClick, disabled, variant = 'primary', className = '' }: any) => {
  const base = 'px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2';
  const variants: Record<string, string> = {
    primary: 'bg-secondary hover:bg-secondary/80 text-white',
    outline: 'border border-border text-white hover:bg-white/5',
    danger: 'bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/30',
    success: 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
};

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
    <span className="text-sm text-white">{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
const CandidatePortal: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const tabs: { id: Tab; label: string; dot?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'jobs', label: 'All Jobs Finder' },
    { id: 'applications', label: 'Job Applications' },
    { id: 'interview', label: 'AI Interview' },
    { id: 'profile', label: 'Profile' },
    { id: 'messages', label: 'Messages' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="w-2 h-8 bg-secondary rounded-sm" />
        <h1 className="text-2xl md:text-3xl font-bold text-white">Candidate Portal</h1>
        <Badge text="Job Seeker" />
        <span className="ml-auto text-sm text-muted-foreground">Welcome, {user?.name}</span>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-card/50 p-1 rounded-xl border border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-max px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${tab === t.id
              ? 'bg-secondary text-white shadow'
              : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div key={tab} className="animate-in fade-in duration-300">
        {tab === 'dashboard' && <DashboardTab userId={user?.id || ''} refreshKey={refreshKey} />}
        {tab === 'jobs' && <JobsFinderTab userId={user?.id || ''} refreshKey={refreshKey} onRefresh={() => setRefreshKey(k => k + 1)} />}
        {tab === 'applications' && <PipelineTab userId={user?.id || ''} refreshKey={refreshKey} />}
        {tab === 'interview' && <InterviewTab userId={user?.id || ''} refreshKey={refreshKey} />}
        {tab === 'profile' && <ProfileTab userId={user?.id || ''} refreshKey={refreshKey} onRefresh={() => setRefreshKey(k => k + 1)} />}
        {tab === 'messages' && <MessagesTab userId={user?.id || ''} />}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 0 — DASHBOARD CONTROL CENTER
// ═══════════════════════════════════════════════════════════
const DashboardTab: React.FC<{ userId: string } & RefreshProps> = ({ userId, refreshKey }) => {
  const [profile, setProfile] = useState<any>(null);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [p, pl, j, n] = await Promise.all([
          fetch(`${API}/candidate/profile/${userId}`).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/candidate/pipeline/${userId}`).then(r => r.json()).catch(() => []),
          fetch(`${API}/jobs`).then(r => r.json()).catch(() => []),
          fetch(`${API}/candidate/agent-feed/${userId}`).then(r => r.json()).catch(() => []),
        ]);
        setProfile(p || {});
        setPipeline(Array.isArray(pl) ? pl : []);
        setJobs(Array.isArray(j) ? j : []);
        setNotifications(Array.isArray(n) ? n : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, refreshKey]);

  const scoreJob = (job: any) => {
    const resumeSkills = (profile?.skills || []).map((s: string) => s.toLowerCase());
    if (!resumeSkills.length) return 0;
    const txt = `${job.title ?? ''} ${job.description ?? ''}`.toLowerCase();
    const hits = resumeSkills.filter((skill: string) => txt.includes(skill)).length;
    return Math.min(100, Math.round((hits / Math.max(1, resumeSkills.length)) * 100));
  };

  const topMatches = (jobs || [])
    .map((job: any) => ({ ...job, matchScore: scoreJob(job) }))
    .sort((a: any, b: any) => b.matchScore - a.matchScore)
    .slice(0, 6);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Resume</h3>
          <p className="text-2xl font-bold text-white">{profile?.resume_filename ? 'Uploaded' : 'Missing'}</p>
          <p className="text-sm text-muted-foreground mt-1">{profile?.resume_filename || 'Please upload resume for best matches.'}</p>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Active applications</h3>
          <p className="text-2xl font-bold text-white">{pipeline.filter(p => !['rejected', 'withdrawn'].includes(p.stage)).length}</p>
          <p className="text-sm text-muted-foreground mt-1">Track status & AI score in one place.</p>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Profile completeness</h3>
          <p className="text-2xl font-bold text-white">{profile?.profile_completeness ?? 0}%</p>
          <p className="text-sm text-muted-foreground mt-1">Higher completion leads to more visibility.</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <h2 className="text-lg font-bold text-white mb-3">Top AI-Matched Jobs</h2>
        {topMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches yet. Add a resume and skills to unlock recommendations.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topMatches.map((job: any) => (
              <div key={job.id} className="border border-border rounded-lg p-3 bg-background/50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white text-sm">{job.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{job.company || job.location || 'Top match'}</p>
                  </div>
                  <Badge text={`${job.matchScore}%`} color="bg-primary/10 text-primary border-primary/20" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h2 className="text-lg font-bold text-white mb-3">Recent Notifications</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.slice(0, 5).map(n => (
              <li key={n.id} className="border border-border rounded-lg p-3 bg-background/50">
                <p className="text-sm text-white">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.timestamp || Date.now()).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 1 — ALL JOBS FINDER
// ═══════════════════════════════════════════════════════════
const JobsFinderTab: React.FC<{ userId: string } & RefreshProps> = ({ userId, refreshKey, onRefresh }) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);
  const [appliedResults, setAppliedResults] = useState<Record<string, any>>({});

  const loadJobsAndPipeline = async () => {
    setLoading(true);
    try {
      const [jobsData, profileData, pipelineData] = await Promise.all([
        fetch(`${API}/jobs`).then(r => r.json()).catch(() => []),
        fetch(`${API}/candidate/profile/${userId}`).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/candidate/pipeline/${userId}`).then(r => r.json()).catch(() => []),
      ]);

      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setProfile(profileData || {});

      const pipeline = Array.isArray(pipelineData) ? pipelineData : [];

      const ACTIVE_STAGES = new Set(['applied', 'ai_screen', 'ai_interview', 'human_screening', 'offer']);
      // Only mark as "applied" (blocking) when the application is actively in progress
      const appliedIds = pipeline
        .filter((a: any) => ACTIVE_STAGES.has(a.stage))
        .map((a: any) => a.job_id);
      setAppliedJobs(appliedIds);
      setAppliedResults(pipeline.reduce((acc: Record<string, any>, app: any) => {
        acc[app.job_id] = app;
        return acc;
      }, {}));

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobsAndPipeline();
  }, [refreshKey, userId]);

  const calcMatchScore = (job: any): number => {
    const skills = (profile?.skills || []).map((s: string) => s.toLowerCase());
    if (!skills.length) return 0;
    const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    const hits = skills.filter((skill: string) => text.includes(skill)).length;
    return Math.min(100, Math.round((hits / Math.max(1, skills.length)) * 100));
  };

  const calcWhyMatched = (job: any): string => {
    const skills = (profile?.skills || []).map((s: string) => s.toLowerCase());
    if (!skills.length) {
      return 'No skills in profile yet. Add skills for better matching insights.';
    }
    const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    const matches = skills.filter((skill: string) => text.includes(skill));
    if (!matches.length) {
      return 'No direct skill overlap found—consider upskilling for this role.';
    }
    return `Matched on skills: ${matches.slice(0, 5).join(', ')}${matches.length > 5 ? '...' : ''}`;
  };

  const applyWithAI = async (job: any) => {
    if (!profile?.resume_text) {
      toast.error('Please upload your resume first in Profile tab.');
      return;
    }

    setApplyingJobId(job.id);
    try {
      const fd = new FormData();
      fd.append('candidateId', userId);
      fd.append('jobId', job.id);

      const res = await fetch(`${API}/candidate/apply`, { method: 'POST', body: fd });
      if (!res.ok) {
        const errText = await res.text();
        // Try to parse JSON error detail
        try {
          const errJson = JSON.parse(errText);
          throw new Error(errJson.detail || errText);
        } catch { throw new Error(errText); }
      }
      const data = await res.json();

      // Reload fresh pipeline state — don't manually patch appliedJobs here
      await loadJobsAndPipeline();

      // Show appropriate message based on outcome
      const score = data.scoringResult?.score || 0;
      if (score > 25) {
        toast.success(`Advanced to AI Interview! Score: ${score}/100`);
      } else {
        toast.error(`Application not advanced. Score: ${score}/100 (minimum 26 required)`);
      }

      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.message || 'Apply with AI failed');
    }
    setApplyingJobId(null);
  };

  const filtered = jobs.filter(job =>
    query.trim().length === 0 || `${job.title} ${job.description} ${job.company || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-3">
      <div className="glass-card p-4">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search jobs by skill, title or company" className="w-full bg-background/50 border border-border rounded-lg p-2 text-sm text-white" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(job => {
          const score = calcMatchScore(job);
          const why = calcWhyMatched(job);
          const pipelineEntry = appliedResults[job.id];
          const currentStage = pipelineEntry?.stage || null;

          const ACTIVE_STAGES = new Set(['applied', 'ai_screen', 'ai_interview', 'human_screening', 'offer']);
          const isActiveApplication = currentStage && ACTIVE_STAGES.has(currentStage);
          const isRejectedOrWithdrawn = currentStage === 'rejected' || currentStage === 'withdrawn';
          const isApplying = applyingJobId === job.id;

          // Button disabled: only when actively in pipeline or currently submitting
          const btnDisabled = isActiveApplication || isApplying;

          let statusBadge = { text: 'Open', color: 'bg-secondary/10 text-secondary border-secondary/20' };
          if (isActiveApplication) statusBadge = { text: currentStage!.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), color: 'bg-primary/10 text-primary border-primary/20' };
          else if (isRejectedOrWithdrawn) statusBadge = { text: 'Can Reapply', color: 'bg-warning/10 text-warning border-warning/20' };

          let btnLabel: React.ReactNode = 'Apply with AI';
          let btnVariant = 'success';
          if (isApplying) { btnLabel = <><Spinner /> Applying…</>; }
          else if (isActiveApplication) { btnLabel = 'Applied'; btnVariant = 'outline'; }
          else if (isRejectedOrWithdrawn) { btnLabel = 'Reapply with AI'; btnVariant = 'outline'; }

          return (
            <div key={job.id} className={`glass-card p-4 border ${isActiveApplication ? 'border-primary/30' : isRejectedOrWithdrawn ? 'border-warning/20' : 'border-border'}`}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">{job.title}</h3>
                  <p className="text-xs text-muted-foreground">{job.company || 'Unknown'} · {job.location || 'Remote'}</p>
                </div>
                <Badge text={`${score}%`} color="bg-primary/10 text-primary border-primary/20" />
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{job.description}</p>
              <p className="text-xs text-white pt-3"><strong>Why matched:</strong> {why}</p>
              <div className="flex justify-between items-center mt-3">
                <Badge text={statusBadge.text} color={statusBadge.color} />
                <Btn onClick={() => applyWithAI(job)} disabled={btnDisabled} variant={btnVariant}>
                  {btnLabel}
                </Btn>
              </div>
              {pipelineEntry?.scoringResult && (
                <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-muted-foreground">
                  <p className="font-medium text-white">AI Screening Result: {pipelineEntry.scoringResult.score}/100</p>
                  <p><strong className="text-white">Strengths:</strong> {pipelineEntry.scoringResult.strengths || 'N/A'}</p>
                  <p><strong className="text-white">Weaknesses:</strong> {pipelineEntry.scoringResult.weaknesses || 'N/A'}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 1 — PROFILE & SKILLS
// ═══════════════════════════════════════════════════════════
const ProfileTab: React.FC<{ userId: string } & RefreshProps> = ({ userId, refreshKey, onRefresh }) => {
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [uploadingResume, setUploadingResume] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const p = await fetch(`${API}/candidate/profile/${userId}`).then(r => r.json()).catch(() => ({}));
      setProfile(p || {});
      setLoading(false);
    };
    load();
  }, [userId, refreshKey]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/candidate/profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      setProfile(data);
      toast.success('Profile saved!');
      onRefresh?.();
    } catch { toast.error('Failed to save profile'); }
    setSaving(false);
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    setProfile((p: any) => ({ ...p, skills: [...(p.skills || []), newSkill.trim()] }));
    setNewSkill('');
  };

  const removeSkill = (idx: number) => {
    setProfile((p: any) => ({ ...p, skills: (p.skills || []).filter((_: any, i: number) => i !== idx) }));
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/candidate/profile/${userId}/resume`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const refreshed = await fetch(`${API}/candidate/profile/${userId}`).then(r => r.json()).catch(() => null);
      setProfile((p: any) => ({ ...p, resume_filename: data.filename, ...(refreshed || {}) }));
      toast.success('Resume uploaded and profile updated!');
      onRefresh?.();
    } catch { toast.error('Resume upload failed'); }
    setUploadingResume(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  const completeness = profile.profile_completeness || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Profile form */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Universal Profile</h2>
          <div className="text-right">
            <div className="text-2xl font-bold text-secondary">{completeness}%</div>
            <div className="text-xs text-muted-foreground">complete</div>
          </div>
        </div>
        <div className="h-2 bg-border rounded-full">
          <div className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-500" style={{ width: `${completeness}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Current Role</label>
            <Input value={profile.current_role || ''} onChange={e => setProfile((p: any) => ({ ...p, current_role: e.target.value }))} placeholder="e.g. SDE-2" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Experience (yrs)</label>
            <Input type="number" value={profile.experience_years || ''} onChange={e => setProfile((p: any) => ({ ...p, experience_years: parseFloat(e.target.value) || 0 }))} placeholder="4.5" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notice Period</label>
            <Input value={profile.notice_period || ''} onChange={e => setProfile((p: any) => ({ ...p, notice_period: e.target.value }))} placeholder="30 days" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Location</label>
            <Input value={profile.location || ''} onChange={e => setProfile((p: any) => ({ ...p, location: e.target.value }))} placeholder="Bengaluru / Remote" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Salary Min (LPA)</label>
            <Input type="number" value={profile.salary_min || ''} onChange={e => setProfile((p: any) => ({ ...p, salary_min: parseFloat(e.target.value) || 0 }))} placeholder="20" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Salary Max (LPA)</label>
            <Input type="number" value={profile.salary_max || ''} onChange={e => setProfile((p: any) => ({ ...p, salary_max: parseFloat(e.target.value) || 0 }))} placeholder="28" />
          </div>
        </div>

        <div>
          <SectionTitle>Skills (Agent-Indexed)</SectionTitle>
          <div className="flex flex-wrap gap-2 mb-2 min-h-8">
            {(profile.skills || []).map((s: string, i: number) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 bg-secondary/10 border border-secondary/20 text-secondary text-xs rounded-full">
                {s}<button onClick={() => removeSkill(i)} className="text-secondary/60 hover:text-destructive text-xs ml-1">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSkill()} placeholder="Add a skill..." />
            <Btn onClick={addSkill} variant="outline">Add</Btn>
          </div>
        </div>

        <div>
          <SectionTitle>Summary</SectionTitle>
          <Textarea
            rows={3}
            value={profile.summary || ''}
            onChange={e => setProfile((p: any) => ({ ...p, summary: e.target.value }))}
            placeholder="Professional summary / career highlights"
          />
        </div>

        <div>
          <SectionTitle>Projects</SectionTitle>
          <Textarea
            rows={4}
            value={profile.projects || ''}
            onChange={e => setProfile((p: any) => ({ ...p, projects: e.target.value }))}
            placeholder="Describe key projects, outcomes, and awards (Markdown allowed)."
          />
          <p className="text-xs text-muted-foreground">Tip: Include metrics (e.g., \"Reduced latency by 40%\", \"Led launch to 5M users\").</p>
        </div>

        <div>
          <SectionTitle>Achievements</SectionTitle>
          <Textarea
            rows={3}
            value={Array.isArray(profile.achievements) ? profile.achievements.join('\n') : (profile.achievements || '')}
            onChange={e => setProfile((p: any) => ({ ...p, achievements: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
            placeholder="List achievements, one per line"
          />
        </div>

        <Btn onClick={save} disabled={saving} className="w-full justify-center">
          {saving ? <><Spinner /> Saving…</> : '✓ Save Profile'}
        </Btn>
      </div>

      {/* Right: Resume + Apply */}
      <div className="space-y-6">
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Resume</h2>
          {profile.resume_filename && (
            <div className="flex items-center gap-3 p-3 bg-background/50 border border-border rounded-lg">
              <div className="w-10 h-10 bg-destructive/20 rounded-lg flex items-center justify-center text-destructive text-xs font-bold">PDF</div>
              <div>
                <p className="text-sm text-white font-medium">{profile.resume_filename}</p>
                <p className="text-xs text-muted-foreground">Uploaded & indexed</p>
              </div>
            </div>
          )}
          <label className="block cursor-pointer">
            <span className="block text-xs text-muted-foreground mb-1">{profile.resume_filename ? 'Replace resume' : 'Upload resume (PDF/TXT)'}</span>
            <input type="file" accept=".pdf,.txt" onChange={handleResumeUpload} className="hidden" />
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground hover:border-secondary/50 hover:text-secondary transition">
              {uploadingResume ? <Spinner /> : '📎 Click to upload'}
            </div>
          </label>
        </div>

      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 2 — MATCH FEED
// ═══════════════════════════════════════════════════════════
const FeedTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetch(`${API}/candidate/agent-feed/${userId}`).then(r => r.json()).catch(() => []);
    setActivities(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load]);

  const markAllRead = async () => {
    await fetch(`${API}/candidate/agent-feed/${userId}/read-all`, { method: 'POST' });
    setActivities(a => a.map(x => ({ ...x, read: true })));
  };

  const ICONS: Record<string, string> = { new_match: '🎯', shortlisted: '⭐', stage_update: '🔄', rejected: '❌' };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">Agent Activity Feed</h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-xs text-primary">Live</span>
          {activities.some(a => !a.read) && <Btn onClick={markAllRead} variant="outline" className="text-xs py-1">Mark all read</Btn>}
        </div>
      </div>
      {activities.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🤖</div>
          <p>Your agent is working… Apply to roles to see activity here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((a: any) => (
            <div key={a.id} className={`flex gap-3 p-4 rounded-xl border transition ${a.read ? 'border-border bg-background/20' : 'border-secondary/30 bg-secondary/5'}`}>
              <div className="text-2xl">{ICONS[a.type] || '📌'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{a.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.job_title && <span className="text-secondary">{a.job_title} · </span>}{new Date(a.timestamp).toLocaleString()}</p>
              </div>
              {!a.read && <span className="w-2 h-2 bg-secondary rounded-full self-start mt-2 flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 3 — PIPELINE TRACKER
// ═══════════════════════════════════════════════════════════
const PipelineTab: React.FC<{ userId: string } & RefreshProps> = ({ userId, refreshKey }) => {
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/candidate/pipeline/${userId}`)
      .then(r => r.json())
      .then(d => { setPipeline(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId, refreshKey]);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  // Sort all apps by most recent activity first
  const sortedPipeline = [...pipeline].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  const activeApps = sortedPipeline.filter(app => app.stage !== 'rejected' && app.stage !== 'withdrawn');
  const rejectedApps = sortedPipeline.filter(app => app.stage === 'rejected' || app.stage === 'withdrawn');

  const AppCard = ({ app, isRejectedCard = false }: { app: any; isRejectedCard?: boolean }) => {
    const stageIdx = STAGES.indexOf(app.stage);
    const isRejected = app.stage === 'rejected' || app.stage === 'withdrawn';
    const timeLabel = app.updated_at || app.created_at
      ? new Date(app.updated_at || app.created_at).toLocaleString()
      : null;

    return (
      <div
        key={app.application_id}
        className={`p-5 space-y-4 rounded-xl border transition-all ${isRejectedCard
          ? 'bg-destructive/5 border-destructive/25 shadow-[0_0_0_1px_rgba(239,68,68,0.1)] opacity-85'
          : 'glass-card border-border'
          }`}
      >
        {/* Header */}
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-base font-bold ${isRejectedCard ? 'text-white/70' : 'text-white'}`}>
                {app.job_title}
              </h3>
              {isRejectedCard && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                  ✕ {app.stage === 'withdrawn' ? 'Withdrawn' : 'Rejected'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {app.employer_name}{app.location && ` · ${app.location}`}
              </p>
              {timeLabel && (
                <span className="text-xs text-muted-foreground/60">· {timeLabel}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge
              text={`${app.match_score}/100`}
              color={isRejectedCard ? 'bg-destructive/10 text-destructive/70 border-destructive/20' : 'bg-primary/10 text-primary border-primary/20'}
            />
            <Badge
              text={app.stage}
              color={isRejected
                ? 'bg-destructive/10 text-destructive border-destructive/20'
                : 'bg-secondary/10 text-secondary border-secondary/20'
              }
            />
          </div>
        </div>

        {/* Stage progress bar — only for active apps */}
        {!isRejected && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1 font-medium">
              {STAGES.map(s => (
                <div key={s} className={`flex-1 text-center capitalize ${s === app.stage ? 'text-white' : ''}`}>
                  {s.replace('_', ' ')}
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              {STAGES.map((s, i) => (
                <div
                  key={s}
                  className={`flex-1 h-1.5 rounded-full transition-all ${i <= stageIdx ? STAGE_COLORS[s] || 'bg-secondary' : 'bg-border'}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Rejected — visual struck-through bar */}
        {isRejected && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-destructive/30" />
            <span className="text-xs text-destructive/60 font-medium">Application ended</span>
            <div className="flex-1 h-1 rounded-full bg-destructive/30" />
          </div>
        )}

        {/* Stage history */}
        {app.stage_history?.length > 0 && (
          <div className="space-y-1 pt-1">
            <SectionTitle>Stage History</SectionTitle>
            {app.stage_history.map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STAGE_COLORS[h.stage] || 'bg-secondary'}`} />
                <span className="capitalize text-white/70">{h.stage.replace('_', ' ')}</span>
                <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                {h.note && <span className="italic">— {h.note}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header / stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-white">Live Pipeline Tracker</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary inline-block" />
            {activeApps.length} Active
          </span>
          {rejectedApps.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
              {rejectedApps.length} Rejected / Withdrawn
            </span>
          )}
        </div>
      </div>

      {pipeline.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <div className="text-4xl mb-3">📋</div>
          <p>No active applications yet. Apply to roles in the All Jobs Finder tab.</p>
        </div>
      ) : (
        <>
          {/* ── Active Applications ── */}
          {activeApps.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-5 bg-secondary rounded-sm" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Applications</h3>
                <span className="ml-auto text-xs text-muted-foreground">Sorted by most recent</span>
              </div>
              {activeApps.map(app => <AppCard key={app.application_id} app={app} isRejectedCard={false} />)}
            </div>
          )}

          {/* ── Rejected / Withdrawn ── */}
          {rejectedApps.length > 0 && (
            <div className="space-y-3">
              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-destructive/20" />
                <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-destructive/25 bg-destructive/5">
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-xs font-bold text-destructive uppercase tracking-widest">
                    Rejected / Withdrawn
                  </span>
                </div>
                <div className="flex-1 h-px bg-destructive/20" />
              </div>
              {rejectedApps.map(app => <AppCard key={app.application_id} app={app} isRejectedCard={true} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// PAST INTERVIEW REPORTS — expandable history cards
// ═══════════════════════════════════════════════════════════
const DIMENSION_LABELS: Record<string, string> = {
  communication_clarity: 'Communication Clarity',
  technical_depth: 'Technical Depth',
  problem_solving_approach: 'Problem-Solving',
  cultural_signals: 'Cultural Signals',
};

const ScoreBar = ({ score }: { score: number }) => {
  const clamp = Math.max(0, Math.min(100, score));
  const color = clamp >= 70 ? 'bg-emerald-400' : clamp >= 45 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="h-2 bg-border rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clamp}%` }} />
    </div>
  );
};

const PastInterviewReports: React.FC<{ sessions: any[]; API: string; renderDimensionBars: (dims: any) => React.ReactNode }> = ({ sessions, API, renderDimensionBars }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const completedSessions = sessions.filter(s => s.status === 'completed');
  const inProgressSessions = sessions.filter(s => s.status === 'in_progress');

  const toggleExpand = async (sessionId: string) => {
    if (expanded === sessionId) { setExpanded(null); return; }
    setExpanded(sessionId);
    if (detail[sessionId]) return; // already loaded
    setLoading(sessionId);
    try {
      const data = await fetch(`${API}/candidate/mock-interview/${sessionId}`).then(r => r.json());
      setDetail(prev => ({ ...prev, [sessionId]: data }));
    } catch { /* ignore */ }
    setLoading(null);
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-5 bg-primary rounded-sm" />
          <h3 className="text-base font-bold text-white">Past Interview Reports</h3>
          <span className="ml-auto text-xs text-muted-foreground">{completedSessions.length} completed · {inProgressSessions.length} in progress</span>
        </div>

        {/* In-progress sessions */}
        {inProgressSessions.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between p-3 bg-warning/5 border border-warning/20 rounded-lg">
            <div>
              <p className="text-sm text-white font-medium">{s.job_title}</p>
              <p className="text-xs text-muted-foreground">{new Date(s.created_at || Date.now()).toLocaleDateString()} · <span className="text-warning">In Progress</span></p>
            </div>
            <Badge text="In Progress" color="bg-warning/10 text-warning border-warning/20" />
          </div>
        ))}

        {completedSessions.length === 0 && inProgressSessions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No interview sessions yet.</p>
        )}

        {/* Completed sessions */}
        {completedSessions.map((s: any) => {
          const isOpen = expanded === s.id;
          const d = detail[s.id];
          const score = s.overall_score ?? s.gap_score ?? 0;
          const scoreColor = score >= 70 ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : score >= 45 ? 'bg-warning/10 text-warning border-warning/20' : 'bg-destructive/10 text-destructive border-destructive/20';
          const rec = (s.recommendation || d?.recommendation || '').toUpperCase();

          return (
            <div key={s.id} className={`rounded-xl border transition-all overflow-hidden ${isOpen ? 'border-primary/30 bg-primary/5' : 'border-border bg-background/30'}`}>
              {/* Header row — always visible */}
              <button
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-white/5 transition"
                onClick={() => toggleExpand(s.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{s.job_title}</p>
                    {rec && <Badge text={`AI: ${rec}`} color={rec === 'ADVANCE' || rec === 'PASS' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : rec === 'HOLD' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-destructive/10 text-destructive border-destructive/20'} />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.completed_at || s.created_at || Date.now()).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge text={`${score}/100`} color={scoreColor} />
                  <span className="text-muted-foreground text-sm">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t border-border/50 p-5 space-y-5">
                  {loading === s.id ? (
                    <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
                  ) : d ? (
                    <>
                      {/* Score + dimension bars */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Overall Score</p>
                          <p className="text-3xl font-black text-primary">{d.overall_score ?? d.gap_score ?? 0}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                          {rec && <p className="text-xs"><span className="text-muted-foreground">Recommendation: </span><span className={rec === 'ADVANCE' || rec === 'PASS' ? 'text-emerald-400 font-semibold' : rec === 'HOLD' ? 'text-warning font-semibold' : 'text-destructive font-semibold'}>{rec}</span></p>}
                        </div>
                        {d.dimension_scores && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Dimensions</p>
                            {Object.entries(d.dimension_scores).map(([key, val]: [string, any]) => (
                              <div key={key}>
                                <div className="flex justify-between text-xs mb-0.5">
                                  <span className="text-white/70">{DIMENSION_LABELS[key] || key.replace(/_/g, ' ')}</span>
                                  <span className="text-white font-medium">{Math.round(val)}/100</span>
                                </div>
                                <ScoreBar score={val} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* AI Recommendation Reasoning */}
                      {(d.recommendation_reasoning || d.overall_feedback) && (
                        <div className="p-4 bg-background/50 border border-border rounded-lg">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">AI Evaluation Summary</p>
                          <p className="text-sm text-white leading-relaxed">{d.recommendation_reasoning || d.overall_feedback}</p>
                        </div>
                      )}

                      {/* Strengths & Weaknesses */}
                      {d.dimension_scores && (() => {
                        const entries = Object.entries(d.dimension_scores) as [string, number][];
                        const sorted = [...entries].sort((a, b) => b[1] - a[1]);
                        const strengths = sorted.slice(0, 2);
                        const weaknesses = [...entries].sort((a, b) => a[1] - b[1]).slice(0, 2);
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-4 bg-emerald-400/5 border border-emerald-400/20 rounded-lg">
                              <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2 font-semibold">✓ Strengths</p>
                              {strengths.map(([k, v]) => (
                                <div key={k} className="flex justify-between text-sm py-0.5">
                                  <span className="text-white/80">{DIMENSION_LABELS[k] || k.replace(/_/g, ' ')}</span>
                                  <span className="text-emerald-400 font-semibold">{Math.round(v)}/100</span>
                                </div>
                              ))}
                            </div>
                            <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                              <p className="text-xs text-destructive uppercase tracking-wider mb-2 font-semibold">✗ Areas to Improve</p>
                              {weaknesses.map(([k, v]) => (
                                <div key={k} className="flex justify-between text-sm py-0.5">
                                  <span className="text-white/80">{DIMENSION_LABELS[k] || k.replace(/_/g, ' ')}</span>
                                  <span className="text-destructive font-semibold">{Math.round(v)}/100</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Notable Quotes */}
                      {d.notable_quotes?.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Notable Moments</p>
                          <div className="space-y-2">
                            {d.notable_quotes.map((q: any, i: number) => (
                              <div key={i} className="p-3 bg-background/50 border border-secondary/20 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge text={q.dimension ? DIMENSION_LABELS[q.dimension] || q.dimension.replace(/_/g, ' ') : 'note'} color="bg-secondary/10 text-secondary border-secondary/20" />
                                </div>
                                <p className="text-sm text-white italic">"{q.quote}"</p>
                                {q.why_it_matters && <p className="text-xs text-muted-foreground mt-1">{q.why_it_matters}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Full Transcript */}
                      {(d.transcript?.length > 0 || d.questions?.length > 0) && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Full Q&A Transcript</p>
                          <div className="space-y-3">
                            {(d.transcript?.length > 0 ? d.transcript : d.questions?.map((q: string, i: number) => ({ question: q, answer: d.answers?.[i] || '', feedback: d.reviews?.[i]?.review || '' }))).map((t: any, i: number) => (
                              <div key={i} className="rounded-lg border border-border overflow-hidden">
                                <div className="px-4 py-2 bg-background/60 border-b border-border/50 flex justify-between items-center">
                                  <span className="text-xs font-bold text-secondary uppercase tracking-wider">Q{i + 1}</span>
                                  {t.timestamp && <span className="text-xs text-muted-foreground">{new Date(t.timestamp).toLocaleTimeString()}</span>}
                                </div>
                                <div className="p-4 space-y-3">
                                  <p className="text-sm text-white font-semibold">{t.question}</p>
                                  <div className="pl-3 border-l-2 border-border">
                                    <p className="text-xs text-muted-foreground mb-1">Your Answer</p>
                                    <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{t.answer || '—'}</p>
                                  </div>
                                  {(t.feedback || t.review || d.reviews?.[i]?.review) && (
                                    <div className="pl-3 border-l-2 border-warning/40 bg-warning/5 rounded-r-lg p-2">
                                      <p className="text-xs text-warning font-semibold mb-0.5">💡 AI Feedback</p>
                                      <p className="text-xs text-white/70 leading-relaxed">{t.feedback || t.review || d.reviews?.[i]?.review}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Could not load report details.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 4 — AI INTERVIEW PREP
// ═══════════════════════════════════════════════════════════
const InterviewTab: React.FC<{ userId: string; refreshKey?: number }> = ({ userId, refreshKey }) => {
  const MAX_QUESTIONS = 7;
  const personaText = "You are a friendly but rigorous interviewer. Ask one question at a time, follow up when needed, and keep the conversation focused and respectful.";

  const [pipeline, setPipeline] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState('');

  const [phase, setPhase] = useState<'briefing' | 'chat' | 'feedback'>('briefing');
  const [sessionId, setSessionId] = useState('');

  const [total, setTotal] = useState(MAX_QUESTIONS);
  const [qIndex, setQIndex] = useState(0);
  const [currentQ, setCurrentQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const [startedAt, setStartedAt] = useState<string>('');
  const [elapsedMs, setElapsedMs] = useState(0);

  const [chatHistory, setChatHistory] = useState<Array<{ question: string; answer: string; timestamp: string }>>([]);

  const [report, setReport] = useState<any>(null);
  const [legacyReviews, setLegacyReviews] = useState<any[]>([]);
  const [legacyOverallFeedback, setLegacyOverallFeedback] = useState('');
  const [legacyGapScore, setLegacyGapScore] = useState(0);

  const refreshAll = async () => {
    const p = await fetch(`${API}/candidate/pipeline/${userId}`).then(r => r.json()).catch(() => ({}));
    const s = await fetch(`${API}/candidate/mock-interviews/${userId}`).then(r => r.json()).catch(() => []);
    const apps = Array.isArray(p) ? p : (Array.isArray((p as any)?.applications) ? (p as any).applications : []);
    setPipeline(apps);
    setSessions(Array.isArray(s) ? s : []);

    const eligible = (Array.isArray(apps) ? apps : []).filter((a: any) => a.stage === 'ai_interview');
    if (!selectedApp && eligible.length > 0) setSelectedApp(eligible[0].application_id);
  };

  useEffect(() => { refreshAll(); }, [userId, refreshKey]);

  // Soft timer for the ongoing interview.
  useEffect(() => {
    if (phase !== 'chat' || !startedAt) return;
    const t = setInterval(() => {
      const s = new Date(startedAt).getTime();
      const now = Date.now();
      if (!Number.isNaN(s)) setElapsedMs(Math.max(0, now - s));
    }, 1000);
    return () => clearInterval(t);
  }, [phase, startedAt]);

  const eligibleApps = (pipeline || []).filter((a: any) => a.stage === 'ai_interview');
  const selectedAppObj = eligibleApps.find((a: any) => a.application_id === selectedApp);

  const inProgressSession = sessions.find((s: any) => s.application_id === selectedApp && s.status === 'in_progress');
  const completedForSelected = sessions.find((s: any) => s.application_id === selectedApp && s.status === 'completed');

  const formatElapsed = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const loadSessionState = async (sid: string) => {
    const sd = await fetch(`${API}/candidate/mock-interview/${sid}`).then(r => r.json()).catch(() => null);
    if (!sd) return;
    setSessionId(sid);
    setTotal(MAX_QUESTIONS);
    setQIndex(sd.current_index ?? 0);
    setStartedAt(sd.started_at || sd.created_at || '');
    const answers = Array.isArray(sd.answers) ? sd.answers : [];
    const timestamps = Array.isArray(sd.answer_timestamps) ? sd.answer_timestamps : [];
    const questions = Array.isArray(sd.questions) ? sd.questions : [];
    setChatHistory(answers.map((a: string, i: number) => ({
      question: questions[i] || '',
      answer: a,
      timestamp: timestamps[i] || '',
    })));
    setCurrentQ(questions[sd.current_index ?? 0] || '');
  };

  const startInterview = async (appId?: string) => {
    const toStart = appId || selectedApp;
    if (!toStart) return;
    setLoading(true);
    setLegacyReviews([]);
    setLegacyOverallFeedback('');
    setLegacyGapScore(0);
    setReport(null);
    try {
      const res = await fetch(`${API}/candidate/mock-interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: toStart, candidate_id: userId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPhase('chat');
      await loadSessionState(data.session_id);
      setAnswer('');
      // Keep the server-provided question text even if it differs from session load.
      if (data.question) setCurrentQ(data.question);
      if (typeof data.index === 'number') setQIndex(data.index);
      if (typeof data.total === 'number') setTotal(data.total);
    } catch (e: any) {
      toast.error(e.message || 'Failed to start interview');
      setPhase('briefing');
    }
    setLoading(false);
  };

  const submitAnswer = async () => {
    if (!answer.trim() || !sessionId) return;
    const toSend = answer.trim();
    setLoading(true);
    try {
      const res = await fetch(`${API}/candidate/mock-interview/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: toSend }),
      });
      const data = await res.json();
      const nowIso = new Date().toISOString();
      setAnswer('');
      if (data.done) {
        const nextReport = data.interview_report || null;
        if (nextReport?.transcript) {
          setChatHistory(nextReport.transcript.map((t: any) => ({ question: t.question, answer: t.answer, timestamp: t.timestamp || '' })));
        }
        setReport(nextReport);
        setLegacyReviews(data.reviews || []);
        setLegacyOverallFeedback(data.overall_feedback || '');
        setLegacyGapScore(data.gap_score || 0);
        setPhase('feedback');
        await refreshAll();
      } else {
        setChatHistory(h => [...h, { question: currentQ, answer: toSend, timestamp: nowIso }]);
        setCurrentQ(data.question || '');
        setQIndex(data.index || 0);
        if (typeof data.total === 'number') setTotal(data.total);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit answer');
    }
    setLoading(false);
  };

  // If we lost the interview eligibility after refresh, return to briefing gracefully.
  useEffect(() => {
    if (phase === 'briefing' && selectedApp && eligibleApps.every((a: any) => a.application_id !== selectedApp)) {
      if (eligibleApps.length > 0) setSelectedApp(eligibleApps[0].application_id);
    }
  }, [phase, selectedApp, eligibleApps]);

  const overallScore = report?.overall_score ?? legacyGapScore ?? 0;
  const dimensionScores = report?.dimension_scores ?? null;
  const recommendation = report?.recommendation ?? (legacyGapScore ? 'hold' : null);
  const recommendationReasoning = report?.recommendation_reasoning ?? legacyOverallFeedback ?? '';

  const strengths = dimensionScores
    ? Object.entries(dimensionScores)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 2)
      .map(([k, v]: any) => ({ key: k, score: v }))
    : [];
  const weaknesses = dimensionScores
    ? Object.entries(dimensionScores)
      .sort((a: any, b: any) => a[1] - b[1])
      .slice(0, 2)
      .map(([k, v]: any) => ({ key: k, score: v }))
    : [];

  const renderDimensionBars = (dims: any) => {
    const items = [
      { key: 'communication_clarity', label: 'Communication clarity' },
      { key: 'technical_depth', label: 'Technical depth' },
      { key: 'problem_solving_approach', label: 'Problem-solving' },
      { key: 'cultural_signals', label: 'Cultural signals' },
    ];
    return (
      <div className="space-y-3">
        {items.map(it => {
          const v = Math.max(0, Math.min(100, Number(dims?.[it.key] ?? 0)));
          return (
            <div key={it.key}>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{it.label}</span>
                <span className="text-white font-medium">{v}/100</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${v}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {phase === 'briefing' && (
        <>
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">AI Interview</h2>

            {eligibleApps.length === 0 ? (
              /* ── No eligible applications ── */
              <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center text-3xl">
                  🎙️
                </div>
                <div>
                  <p className="text-base font-semibold text-white mb-1">No Scheduled AI Interviews</p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    There are no currently active job applications having any scheduled interview.
                    Apply to roles and pass the AI screening to unlock your interview.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/50 border border-border text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-warning inline-block" />
                  Interviews become available when your application reaches the <span className="text-warning font-medium mx-1">AI Interview</span> stage.
                </div>
              </div>
            ) : (
              /* ── Eligible applications exist ── */
              <>
                <p className="text-sm text-muted-foreground">
                  Answer one question at a time. You can pause anytime; your progress is saved automatically.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Select your AI Interview</label>
                    <select
                      className="w-full bg-background/50 border border-border text-white p-2 rounded-lg text-sm"
                      value={selectedApp}
                      onChange={e => setSelectedApp(e.target.value)}
                    >
                      {eligibleApps.map((a: any) => (
                        <option key={a.application_id} value={a.application_id}>
                          {a.job_title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-4 bg-background/50 border border-border rounded-lg space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{selectedAppObj?.job_title || '—'}</p>
                        <p className="text-xs text-muted-foreground">{selectedAppObj?.employer_name || 'Company'} · {selectedAppObj?.location || 'Remote'}</p>
                      </div>
                      {inProgressSession && <Badge text="In progress" color="bg-warning/10 text-warning border-warning/20" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Format: conversational, adaptive follow-ups, max {MAX_QUESTIONS} questions.
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Estimated duration: ~20 minutes.
                    </div>
                  </div>

                  {/* {completedForSelected ? (
                    <div className="text-xs text-muted-foreground">
                      Interview completed for this application. You can review the results below in the employer view.
                    </div>
                  ) : null} */}

                  <div className="flex gap-2">
                    <Btn onClick={() => startInterview()} disabled={loading || !selectedApp} className="w-full justify-center">
                      {loading ? <><Spinner /> Loading…</> : (inProgressSession ? 'Continue Interview' : 'Start Interview')}
                    </Btn>
                    <Btn
                      onClick={() => {
                        toast('You can start later. Progress will be available when you come back.', { duration: 5000, icon: '⏳' });
                      }}
                      disabled={loading || !selectedApp}
                      variant="outline"
                      className="w-full justify-center"
                    >
                      Start Later
                    </Btn>
                  </div>
                </div>
              </>
            )}
          </div>

          {sessions.length > 0 && (
            <PastInterviewReports sessions={sessions} API={API} renderDimensionBars={renderDimensionBars} />
          )}
        </>
      )}

      {phase === 'chat' && (
        <div className="glass-card p-6 space-y-6 max-w-2xl mx-auto">
          <div className="flex justify-between items-start gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Conversation</h2>
              <div className="text-xs text-muted-foreground mt-1">
                Elapsed: <span className="text-white/80">{formatElapsed(elapsedMs)}</span>
              </div>
            </div>
            <Badge text={`Q${qIndex + 1} of ${total}`} />
          </div>

          <div className="h-1.5 bg-border rounded-full">
            <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${(chatHistory.length / total) * 100}%` }} />
          </div>

          <div className="p-5 bg-background/50 border border-secondary/20 rounded-xl">
            <p className="text-sm text-secondary font-semibold mb-1 uppercase tracking-wider">Question {qIndex + 1}</p>
            <p className="text-white text-base leading-relaxed">{currentQ}</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Your Answer</label>
            <Textarea rows={6} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type your answer here…" />
          </div>

          <div className="flex gap-2">
            <Btn onClick={() => setPhase('briefing')} disabled={loading} variant="outline" className="w-full justify-center">
              Save & Exit
            </Btn>
            <Btn onClick={submitAnswer} disabled={loading || !answer.trim()} className="w-full justify-center">
              {loading ? <><Spinner /> Submitting…</> : (qIndex + 1 >= total ? '✓ Submit & Get Report' : '→ Next')}
            </Btn>
          </div>
        </div>
      )}

      {phase === 'feedback' && (
        <div className="space-y-5 max-w-4xl mx-auto">
          <div className="glass-card p-6">
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="text-4xl font-black text-primary">{overallScore}</div>
              <div>
                <p className="text-white font-bold">Overall AI Score</p>
                <p className="text-xs text-muted-foreground">0–100</p>
              </div>
              <Badge
                text={recommendation ? `Recommendation: ${String(recommendation).toUpperCase()}` : 'Recommendation: HOLD'}
                color="bg-warning/10 text-warning border-warning/20"
              />
              <div className="ml-auto">
                <Btn
                  onClick={() => {
                    setPhase('briefing');
                    setSessionId('');
                    setCurrentQ('');
                    setChatHistory([]);
                    setAnswer('');
                    setReport(null);
                    setLegacyReviews([]);
                    setLegacyOverallFeedback('');
                    setLegacyGapScore(0);
                  }}
                  variant="outline"
                >
                  Back
                </Btn>
              </div>
            </div>

            {dimensionScores ? renderDimensionBars(dimensionScores) : null}

            <div className="p-4 mt-4 bg-background/50 border border-border rounded-lg">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">AI Recommendation Reasoning</p>
              <p className="text-sm text-white leading-relaxed">{recommendationReasoning || '—'}</p>
            </div>

            {dimensionScores ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div className="p-4 bg-background/50 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Strengths</p>
                  <div className="space-y-2">
                    {strengths.map((s: any) => (
                      <div key={s.key} className="text-sm text-white">
                        {s.key.replace(/_/g, ' ')}: <span className="text-primary font-medium">{s.score}/100</span>
                      </div>
                    ))}
                    {strengths.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : null}
                  </div>
                </div>
                <div className="p-4 bg-background/50 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Weaknesses</p>
                  <div className="space-y-2">
                    {weaknesses.map((w: any) => (
                      <div key={w.key} className="text-sm text-white">
                        {w.key.replace(/_/g, ' ')}: <span className="text-destructive font-medium">{w.score}/100</span>
                      </div>
                    ))}
                    {weaknesses.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {report?.notable_quotes?.length ? (
            <div className="glass-card p-6 space-y-3">
              <h3 className="text-base font-bold text-white">Notable Quotes</h3>
              {report.notable_quotes.map((q: any, i: number) => (
                <div key={i} className="p-4 bg-background/50 border border-border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge text={q.dimension ? q.dimension.replace(/_/g, ' ') : 'quote'} color="bg-secondary/10 text-secondary border-secondary/20" />
                  </div>
                  <p className="text-sm text-white font-medium">"{q.quote}"</p>
                  {q.why_it_matters ? <p className="text-xs text-muted-foreground mt-2">{q.why_it_matters}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {report?.transcript?.length ? (
            <div className="glass-card p-6 space-y-3">
              <h3 className="text-base font-bold text-white">Transcript</h3>
              <div className="space-y-3">
                {report.transcript.map((t: any, i: number) => (
                  <div key={i} className="p-4 bg-background/50 border border-border rounded-lg">
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Q{i + 1}</p>
                      <p className="text-xs text-muted-foreground">{t.timestamp ? new Date(t.timestamp).toLocaleString() : ''}</p>
                    </div>
                    <p className="text-sm text-secondary font-semibold">{t.question}</p>
                    <p className="text-xs text-muted-foreground mt-2">Your answer</p>
                    <p className="text-sm text-white mt-1 whitespace-pre-wrap">{t.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : legacyReviews.length ? (
            <div className="glass-card p-6 space-y-3">
              <h3 className="text-base font-bold text-white">Legacy Review</h3>
              {legacyReviews.slice(0, 7).map((r: any, i: number) => (
                <div key={i} className="p-4 bg-background/50 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Q{i + 1}</p>
                  <p className="text-sm text-secondary font-semibold">{r.question}</p>
                  <p className="text-xs text-muted-foreground mt-2">Your answer</p>
                  <p className="text-sm text-white mt-1 whitespace-pre-wrap">{r.answer}</p>
                  {r.review ? <p className="text-xs text-muted-foreground mt-2">{r.review}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 5 — SKILL GAP ANALYSIS
// ═══════════════════════════════════════════════════════════
const SkillGapTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/candidate/skill-gap/${userId}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
  const gaps = (data?.gaps || []).sort((a: any, b: any) => (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 3) - (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 3));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Skill Gap Analysis</h2>
          {data?.overall_readiness !== undefined && (
            <div className="text-right">
              <span className="text-2xl font-black text-primary">{data.overall_readiness}%</span>
              <p className="text-xs text-muted-foreground">Overall readiness</p>
            </div>
          )}
        </div>

        {gaps.length === 0 ? (
          <p className="text-muted-foreground text-sm">Apply to roles first to see your skill gap analysis.</p>
        ) : (
          <div className="space-y-4">
            {gaps.map((g: any, i: number) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-white font-medium">{g.skill}</span>
                  <div className="flex items-center gap-2">
                    <Badge text={g.priority} color={g.priority === 'High' ? 'bg-destructive/10 text-destructive border-destructive/30' : g.priority === 'Medium' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-border text-muted-foreground border-border'} />
                    {g.is_gap && <Badge text="Gap" color="bg-destructive/10 text-destructive border-destructive/30" />}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-20 text-right">You:</span>
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${LEVEL_COLORS[g.candidate_level] || 'bg-gray-500'} ${LEVEL_WIDTH[g.candidate_level] || 'w-0'} transition-all duration-700`} />
                    </div>
                    <span className="text-white/70 w-16">{g.candidate_level}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-20 text-right">Required:</span>
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full opacity-40 ${LEVEL_COLORS[g.required_level] || 'bg-gray-500'} ${LEVEL_WIDTH[g.required_level] || 'w-0'}`} />
                    </div>
                    <span className="text-white/70 w-16">{g.required_level}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Learning Recommendations</h3>
        <div className="space-y-2">
          {(data?.recommendations || []).map((r: string, i: number) => (
            <div key={i} className="flex gap-2 p-3 bg-background/50 border border-border rounded-lg text-sm text-white/80">
              <span className="text-secondary flex-shrink-0">→</span>{r}
            </div>
          ))}
          {(data?.recommendations || []).length === 0 && <p className="text-sm text-muted-foreground">No recommendations yet.</p>}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 6 — PRIVACY & CONSENT
// ═══════════════════════════════════════════════════════════
const ConsentTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [consent, setConsent] = useState<any>({ share_profile: true, agent_active: true, salary_visible: true, agency_visible: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/candidate/consent/${userId}`).then(r => r.json()),
      fetch(`${API}/candidate/pipeline/${userId}`).then(r => r.json()),
    ]).then(([c, p]) => {
      setConsent(c || {});
      setPipeline(Array.isArray(p) ? p.filter((a: any) => !['rejected', 'withdrawn'].includes(a.stage)) : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  const updateToggle = async (key: string, val: boolean) => {
    const updated = { ...consent, [key]: val };
    setConsent(updated);
    setSaving(true);
    await fetch(`${API}/candidate/consent/${userId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: val }),
    });
    setSaving(false);
    toast.success('Privacy setting updated');
  };

  const withdraw = async (appId: string) => {
    setWithdrawing(appId);
    await fetch(`${API}/candidate/withdraw/${appId}?user_id=${userId}`, { method: 'POST' });
    setPipeline(p => p.filter(a => a.application_id !== appId));
    toast.success('Withdrawn from pipeline');
    setWithdrawing(null);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="glass-card p-6 space-y-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">Privacy Controls</h2>
          {saving && <Spinner />}
        </div>
        <Toggle checked={consent.agent_active} onChange={v => updateToggle('agent_active', v)} label="🤖 Agent Active (pause to stop all matching)" />
        <Toggle checked={consent.share_profile} onChange={v => updateToggle('share_profile', v)} label="👤 Share profile with matched employers" />
        <Toggle checked={consent.salary_visible} onChange={v => updateToggle('salary_visible', v)} label="💰 Make salary expectation visible" />
        <Toggle checked={consent.agency_visible} onChange={v => updateToggle('agency_visible', v)} label="🏢 Allow visibility to recruitment agencies" />
      </div>

      <div className="glass-card p-6 space-y-3">
        <h2 className="text-lg font-bold text-white">Withdraw from Pipelines</h2>
        <p className="text-xs text-muted-foreground">Remove yourself from specific active applications.</p>
        {pipeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active applications to withdraw from.</p>
        ) : (
          pipeline.map((app: any) => (
            <div key={app.application_id} className="flex items-center justify-between p-3 bg-background/50 border border-border rounded-lg">
              <div>
                <p className="text-sm text-white font-medium">{app.job_title}</p>
                <p className="text-xs text-muted-foreground capitalize">{app.stage}</p>
              </div>
              <Btn variant="danger" onClick={() => withdraw(app.application_id)} disabled={withdrawing === app.application_id} className="text-xs py-1">
                {withdrawing === app.application_id ? <Spinner /> : 'Withdraw'}
              </Btn>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 7 — MESSAGES / OFFER HUB
// ═══════════════════════════════════════════════════════════
function sortChrono(msgs: ChatMessage[]): ChatMessage[] {
  return [...msgs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizeMsg(m: any): ChatMessage {
  return {
    id: String(m.id),
    application_id: m.application_id,
    from_id: m.from_id || '',
    from_name: m.from_name || '',
    to_id: m.to_id,
    content: m.content || '',
    msg_type: m.msg_type || m.type || 'message',
    type: m.type || m.msg_type || 'message',
    timestamp: m.timestamp || '',
    read: m.read ?? false,
    job_title: m.job_title,
  };
}

const MessagesTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [threads, setThreads] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetch(`${API}/candidate/messages/${userId}`).then(r => r.json()).catch(() => []);
    const raw = Array.isArray(data) ? data : [];
    const normalized = raw.map((t: any) => ({
      ...t,
      messages: sortChrono((t.messages || []).map(normalizeMsg)),
    }));
    setThreads(normalized);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSocketMessage = useCallback(
    (incoming: ChatMessage) => {
      const aid = incoming.application_id;
      if (!aid) return;
      setThreads(prev => {
        const idx = prev.findIndex(t => t.application_id === aid);
        const row = normalizeMsg(incoming);
        if (idx === -1) {
          return [...prev, { application_id: aid, job_title: incoming.job_title || 'Conversation', messages: sortChrono([row]) }];
        }
        const t = prev[idx];
        if (t.messages.some((m: ChatMessage) => m.id === incoming.id)) return prev;
        const nextMsgs = sortChrono([...t.messages.map(normalizeMsg), row]);
        const next = [...prev];
        next[idx] = { ...t, messages: nextMsgs, job_title: incoming.job_title || t.job_title };
        return next;
      });
    },
    []
  );

  const { connected } = useMessagingSocket({
    userId,
    applicationId: selected || null,
    enabled: !!userId,
    onMessage: onSocketMessage,
  });

  const sendReply = async (text: string) => {
    if (!text.trim() || !selected) return;
    setSending(true);
    try {
      const response = await fetch(`${API}/candidate/messages/${selected}/reply?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, msg_type: 'message' }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Failed to send reply');
      }
      toast.success('Reply sent');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const selectedThread = threads.find(t => t.application_id === selected);
  const threadMessages: ChatMessage[] = selectedThread ? selectedThread.messages.map(normalizeMsg) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[620px] max-h-[min(85vh,900px)]">
      <div className="lg:col-span-2 glass-card p-4 overflow-y-auto flex flex-col gap-2 rounded-2xl border border-border/60">
        <div className="flex items-center justify-between mb-1">
          <SectionTitle>Conversations</SectionTitle>
          {connected && <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/90">Live</span>}
        </div>
        {threads.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No messages yet.</p>}
        {threads.map((t: any) => {
          const msgs = t.messages as ChatMessage[];
          const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
          const unread = msgs.filter(m => !m.read && m.from_id && m.from_id !== userId).length;
          return (
            <button
              key={t.application_id}
              type="button"
              onClick={() => setSelected(t.application_id)}
              className={`w-full text-left p-3.5 rounded-xl border transition ${selected === t.application_id
                  ? 'border-secondary/50 bg-secondary/10 shadow-md shadow-secondary/5'
                  : 'border-border/60 hover:bg-white/5 hover:border-border'
                }`}
            >
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm font-semibold text-white truncate">{t.job_title || 'Role Discussion'}</p>
                {unread > 0 && (
                  <span className="min-w-[1.25rem] h-5 px-1 bg-secondary text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {unread}
                  </span>
                )}
              </div>
              {lastMsg && (
                <p className="text-xs text-muted-foreground truncate mt-1.5">
                  <span className="text-white/70">{lastMsg.from_name}:</span> {lastMsg.content}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-3 flex flex-col min-h-0">
        {!selected ? (
          <div className="flex-1 glass-card flex items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30">
            <div className="text-center text-muted-foreground px-6">
              <p className="text-sm font-medium text-white/80 mb-1">Select a conversation</p>
              <p className="text-xs">Choose a role thread to read and reply in real time.</p>
            </div>
          </div>
        ) : (
          <ChatPanel
            className="flex-1 h-full min-h-[420px]"
            messages={threadMessages}
            currentUserId={userId}
            title={selectedThread?.job_title || 'Conversation'}
            subtitle="Messaging with the hiring team"
            connected={connected}
            onSend={sendReply}
            sending={sending}
            placeholder="Write a reply… (Enter to send, Shift+Enter for newline)"
            emptyHint="No messages in this thread yet."
          />
        )}
      </div>
    </div>
  );
};

export default CandidatePortal;

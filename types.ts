export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  summary: string;
  skills: string[];
  experience: {
    title: string;
    company: string;
    duration: string;
    responsibilities: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
  }[];
}

export interface ScoringResult {
  score: number;
  strengths: string;
  weaknesses: string;
  reasoning: string;
}

export interface Candidate {
  id: string;
  fileName: string;
  jobId: string;
  parsedData: ParsedResume | null;
  scoringResult: ScoringResult | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  
  // New fields for Candidate Persona
  profileCompleteness?: number;
  autoMatch?: boolean;
  agencyVisibility?: boolean;
  salaryVisible?: boolean;
}

export interface JobSkill {
  name: string;
  weight: number;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  employmentType: 'Full-time' | 'Part-time' | 'Contract' | 'Remote' | 'Hybrid';
  experienceLevel: 'Entry' | 'Mid-level' | 'Senior';
  requiredSkills: JobSkill[];
  responsibilities: string[];
  status: 'Draft' | 'Active' | 'Closed';
  
  // For Employer Tracking
  candidatesMatched?: number;
  inPipeline?: number;
  workflowSteps?: string[];
}

export type Role = 'Candidate' | 'Employer' | 'Admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  profilePictureUrl?: string;
}

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    inApp: boolean;
  };
}
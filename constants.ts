import { Candidate, Job } from './types';

export const MOCK_JOBS: Job[] = [
    {
        id: 'job-1',
        title: 'Senior Frontend React Engineer',
        description: 'We are looking for an experienced Senior Frontend React Engineer to join our dynamic team. The ideal candidate will have a strong background in building modern, scalable, and high-performance web applications using React and its ecosystem.',
        employmentType: 'Full-time',
        experienceLevel: 'Senior',
        requiredSkills: [
            { name: 'React', weight: 95 },
            { name: 'TypeScript', weight: 90 },
            { name: 'Tailwind CSS', weight: 80 },
            { name: 'Next.js', weight: 75 },
        ],
        responsibilities: [
            'Develop new user-facing features using React.js',
            'Build reusable components and front-end libraries for future use',
            'Translate designs and wireframes into high-quality code',
            'Optimize components for maximum performance'
        ],
        status: 'Active'
    },
    {
        id: 'job-2',
        title: 'Lead Backend Engineer (Node.js)',
        description: 'Seeking a talented Lead Backend Engineer to design, develop, and maintain the server-side of our web applications.',
        employmentType: 'Full-time',
        experienceLevel: 'Senior',
        requiredSkills: [
            { name: 'Node.js', weight: 95 },
            { name: 'Express', weight: 85 },
            { name: 'PostgreSQL', weight: 80 },
            { name: 'Docker', weight: 70 },
        ],
        responsibilities: [
            'Lead the backend development team.',
            'Design and implement scalable and secure APIs.',
            'Manage database architecture and migrations.'
        ],
        status: 'Draft'
    }
];

export const MOCK_CANDIDATE: Candidate = {
  id: 'mock-1',
  fileName: 'John_Doe_Resume.pdf',
  jobId: 'job-1',
  status: 'completed',
  parsedData: {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "123-456-7890",
    summary: "Experienced Senior Frontend Engineer with over 8 years of experience in creating beautiful and performant web applications.",
    skills: ["React", "TypeScript", "JavaScript", "Next.js", "Tailwind CSS", "Node.js", "GraphQL"],
    experience: [
      {
        title: "Senior Frontend Engineer",
        company: "Tech Solutions Inc.",
        duration: "2020 - Present",
        responsibilities: ["Led the development of a new e-commerce platform.", "Mentored junior developers."]
      },
      {
        title: "Frontend Developer",
        company: "Web Innovators",
        duration: "2016 - 2020",
        responsibilities: ["Developed and maintained client websites.", "Worked with designers to implement UI/UX features."]
      }
    ],
    education: [
      {
        degree: "Bachelor of Science in Computer Science",
        institution: "State University",
        year: "2016"
      }
    ]
  },
  scoringResult: {
    score: 92,
    strengths: "Excellent match in core skills (React, TypeScript). Strong experience in senior roles aligns with leadership needs. Extensive project history shows capability.",
    weaknesses: "Less experience with data visualization libraries mentioned as a 'nice to have'.",
    reasoning: "The candidate's profile is highly aligned with the job requirements. The 8 years of experience, proficiency in the required tech stack, and leadership experience make them a strong candidate."
  }
};
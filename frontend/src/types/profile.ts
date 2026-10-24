export interface Education {
  [x: string]: any;
  school_name: string;
  board: string;
  school_passing_year: number | "";
  percentage: string;
  college_name: string;
  university: string;
  degree: string;
  branch: string;
  semester: string;
  cgpa: string;
  college_passing_year: number | "";
}

export interface Skill {
  name: string;
  category: string;
  level: string;
}

export interface Project {
  title: string;
  description: string;
  technologies: string;
  role: string;
  github_link: string;
  live_link: string;
  duration: string;
}

export interface Internship {
  company: string;
  role: string;
  duration: string;
  description: string;
}

export interface Experience {
  company: string;
  role: string;
  joining_date: string;
  ending_date: string;
  description: string;
}

export interface Certification {
  [x: string]: any;
  certificate_name: string;
  platform: string;
  issue_date: string;
  credential_id: string;
  credential_link: string;
}

export interface Language {
  language: string;
  proficiency: string;
}

export interface SocialProfiles {
  linkedin: string;
  github: string;
  portfolio: string;
  leetcode: string;
  codechef: string;
  hackerrank: string;
}

export interface Profile {
  id?: number;
  user_id?: number;
  full_name: string;
  phone: string;
  dob: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  country: string;
  profile_photo: string;
  career_objective: string;
  education: Education[];
  skills: Skill[];
  projects: Project[];
  internships: Internship[];
  experience: Experience[];
  certifications: Certification[];
  achievements: string[];
  languages: Language[];
  social_profiles: SocialProfiles;
  resume_url: string;
  created_at?: string;
  updated_at?: string;
  email?: string;
  username?: string;
}

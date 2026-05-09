export interface Resource {
  id: string;
  name: string;
  description: string;
  communities: string[];
  industries: string[];
  locations: string[];
  topics: string[];
  url: string;
  email: string | null;
  /** 1-19, indexes into JOURNEY_STEPS. Empty array if no step keyword matched. */
  journeySteps: number[];
}

export interface Company {
  id: string;
  name: string;
  linkedin: string | null;
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  website: string | null;
  stage: string | null;
  employees: string | null;
  sector: string | null;
  // Brief-required profile fields (optional in catalog, required at submit time).
  foundedYear: number | null;
  hiring: boolean | null;
  jobsUrl: string | null;
  photoUrl: string | null;
  photoUrls: string[];
}

export interface CompanySubmission {
  name: string;
  website: string;
  employees: string;
  sector: string;
  foundedYear: number;
  linkedin: string;
  description: string;
  address: string;
  hiring: boolean;
  jobsUrl: string | null;
  photoUrl: string | null;
  contactEmail: string;
}

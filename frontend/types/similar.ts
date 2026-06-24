export interface SimilarityBreakdown {
  text: number;
  crime_type: number;
  location: number;
  suspects: number;
}

export interface SimilarCase {
  fir_id: number;
  fir_number: string;
  crime_type: string;
  status: string;
  district: string;
  incident_date: string;
  description: string;
  similarity: number;
  breakdown: SimilarityBreakdown;
  shared_suspects: string[];
}

export interface SimilarCasesResult {
  target: {
    id: number;
    fir_number: string;
    crime_type: string;
    status: string;
    district: string;
    description: string;
  };
  similar: SimilarCase[];
  outcome_distribution: Record<string, number>;
  recommendation: string;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface SociologyData {
  kpis: {
    total_suspects: number;
    youth_share_pct: number;
    migrant_share_pct: number;
    unemployed_share_pct: number;
    low_income_share_pct: number;
  };
  age_distribution: NamedCount[];
  gender: NamedCount[];
  education: NamedCount[];
  occupation: NamedCount[];
  income_band: NamedCount[];
  employment: NamedCount[];
  youth_crime: {
    by_crime: Array<{ crime_type: string; youth: number; total: number; youth_pct: number }>;
  };
  gender_crime: {
    by_crime: Array<{ crime_type: string; Male: number; Female: number; Other: number }>;
  };
  risk_factors: {
    factors: Array<{ factor: string; overall_pct: number; property_crime_pct: number }>;
  };
  migration: {
    by_crime: Array<{ crime_type: string; migrant: number; total: number; migrant_pct: number }>;
  };
  economic_stress: {
    districts: Array<{ district: string; suspects: number; stress_index: number }>;
  };
  age_crime_correlation: {
    crime_types: string[];
    matrix: Array<Record<string, string | number>>;
  };
}

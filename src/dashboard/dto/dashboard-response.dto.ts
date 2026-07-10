export interface DashboardResponse {
  performanceStatus: 'Progressing Well' | 'Needs Attention' | 'At Risk';
  activityFrequency: { date: string; hours: number }[];
  averageHoursPerDay: number;
  conceptsMasteredCount: number;
  complianceConcerns: {
    missingAttendanceDays: string[];
    overdueSubjects: string[];
    portfolioUpdatesNeeded: string[];
  };
  strugglingConcepts: {
    conceptName: string;
    lastDifficulty: 'Easy' | 'Medium' | 'Hard';
    activitiesCompleted: number;
    hasHardActivity: boolean;
  }[];
  recentTestScores: {
    subjectName: string;
    score: number;
    letterGrade: string;
    date: string;
  }[];
}

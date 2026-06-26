import { gql } from "@apollo/client";

export const ME = gql`
  query Me { me { id email fullName role department createdAt } }
`;

export const RUBRICS = gql`
  query Rubrics {
    rubrics {
      id name description totalMarks department isTemplate createdAt
      criteria { id name description maxMarks order }
    }
  }
`;

export const ASSIGNMENTS = gql`
  query Assignments {
    assignments {
      id title assignmentType status subject semester section isActive
      openDate dueDate lateSubmissionPenalty createdAt updatedAt
      submissionCount pendingReviewCount
    }
  }
`;

export const STUDENT_ASSIGNMENTS = gql`
  query StudentAssignments {
    studentAssignments {
      id title assignmentType subject semester section isActive
      openDate dueDate lateSubmissionPenalty createdAt
      submissionCount pendingReviewCount
    }
  }
`;

export const ASSIGNMENT = gql`
  query Assignment($id: ID!) {
    assignment(id: $id) {
      id title question modelAnswer assignmentType status subject semester section
      isActive openDate dueDate lateSubmissionPenalty
      instructions submissionGuidelines referenceMaterials notesForStudents
      createdAt updatedAt
      rubric { id name totalMarks criteria { id name description maxMarks order } }
      submissionCount pendingReviewCount
    }
  }
`;

export const GRADING_QUEUE = gql`
  query GradingQueue($assignmentId: ID) {
    gradingQueue(assignmentId: $assignmentId) {
      submissionId studentName studentEmail assignmentTitle assignmentId
      aiScore confidence needsReview status submittedAt
    }
  }
`;

export const SUBMISSION_DETAIL = gql`
  query SubmissionDetail($submissionId: ID!) {
    submissionDetail(submissionId: $submissionId) {
      submissionId studentName studentEmail answerText ocrText submittedAt
      assignmentTitle assignmentQuestion modelAnswer
    }
  }
`;

export const GRADE = gql`
  query Grade($submissionId: ID!) {
    grade(submissionId: $submissionId) {
      id submissionId aiScore finalScore aiFeedback finalFeedback
      confidence needsReview status reviewedAt createdAt
      criterionScores { id criterionId criterionName maxMarks aiScore finalScore comment }
    }
  }
`;

export const STUDENT_GRADE = gql`
  query StudentGrade($submissionId: ID!) {
    studentGrade(submissionId: $submissionId) {
      id finalScore finalFeedback status
      criterionScores { id criterionName maxMarks finalScore comment }
    }
  }
`;

export const STUDENT_DASHBOARD = gql`
  query StudentDashboard {
    studentDashboard {
      totalSubmissions gradedCount pendingCount avgScorePercent weeklyStreak achievementCount
      upcomingDeadlines { id title subject dueDate assignmentType isActive }
      recentGrades {
        submissionId assignmentTitle subject maxMarks finalScore gradeStatus submittedAt
      }
    }
  }
`;

export const STUDENT_NOTIFICATIONS = gql`
  query StudentNotifications {
    studentNotifications { id type title message isRead link createdAt }
  }
`;

export const STUDENT_ANALYTICS = gql`
  query StudentAnalytics {
    studentAnalytics {
      avgScorePercent bestScore bestAssignment totalSubmissions gradedCount
      weeklyScores { week avgPercent count }
      subjectBreakdown { subject avgPercent count }
    }
  }
`;

export const LEARNING_INSIGHTS = gql`
  query LearningInsights {
    learningInsights { area type description recommendation avgPercent }
  }
`;

export const STUDENT_ACHIEVEMENTS = gql`
  query StudentAchievements {
    studentAchievements { id title description icon earned earnedAt }
  }
`;

export const EXPLAIN_MY_GRADE = gql`
  query ExplainMyGrade($submissionId: ID!) {
    explainMyGrade(submissionId: $submissionId) {
      overallJustification aiScore maxMarks
      criteria { criterionName maxMarks score expected found missing justification }
    }
  }
`;

export const ASSIGNMENT_OVERVIEW = gql`
  query AssignmentOverview($assignmentId: ID!) {
    assignmentOverview(assignmentId: $assignmentId) {
      difficulty estimatedMinutes topics objectives summary
    }
  }
`;

export const MY_SUBMISSIONS = gql`
  query MySubmissions {
    mySubmissions {
      submissionId assignmentId assignmentTitle subject maxMarks
      submissionStatus submittedAt gradeStatus
      aiScore finalScore aiFeedback finalFeedback
      criterionScores { criterionName maxMarks finalScore comment }
    }
  }
`;

export const MY_SUBMISSION = gql`
  query MySubmission($assignmentId: ID!) {
    mySubmission(assignmentId: $assignmentId) {
      id assignmentId studentId answerText status submittedAt
    }
  }
`;

export const DASHBOARD_STATS = gql`
  query DashboardStats {
    dashboardStats { totalAssignments totalSubmissions pendingReview published drafts active }
  }
`;

export const ASSIGNMENT_ANALYTICS = gql`
  query AssignmentAnalytics($assignmentId: ID!) {
    assignmentAnalytics(assignmentId: $assignmentId) {
      totalSubmissions gradedCount avgScore maxMarks aiHumanAgreementPct
      highestScore lowestScore passRate completionRate difficultyLevel
      scoreDistribution { range count }
      criterionHeatmap { criterion avgScore maxMarks percent }
    }
  }
`;

export const PERFORMANCE_TRENDS = gql`
  query PerformanceTrends {
    performanceTrends {
      assignmentId assignmentTitle subject avgScorePercent passRate gradedCount createdAt
    }
  }
`;

export const TOP_MISSED_CONCEPTS = gql`
  query TopMissedConcepts($assignmentId: ID!) {
    topMissedConcepts(assignmentId: $assignmentId) {
      concept missedByCount totalStudents percent description
    }
  }
`;

export const EXPLAIN_GRADE = gql`
  query ExplainGrade($submissionId: ID!) {
    explainGrade(submissionId: $submissionId) {
      overallJustification aiScore maxMarks
      criteria {
        criterionName maxMarks score
        expected found missing justification
      }
    }
  }
`;

// ─── HOD queries ───────────────────────────────
export const HOD_DASHBOARD = gql`
  query HodDashboard {
    hodDashboard {
      department facultyCount studentCount assignmentCount submissionCount
      avgScorePercent passRatePercent pendingReviews atRiskStudentCount
      subjectPerformance { subject avgPercent passRate submissions assignments }
      passTrend { week avgPercent count }
    }
  }
`;

export const HOD_FACULTY_WORKLOAD = gql`
  query HodFacultyWorkload {
    hodFacultyWorkload {
      id name email assignments submissions graded pendingReviews avgScorePercent
    }
  }
`;

export const HOD_DEPARTMENT_STUDENTS = gql`
  query HodDepartmentStudents {
    hodDepartmentStudents {
      id name email submissions avgScorePercent atRisk trend
    }
  }
`;

export const HOD_AT_RISK_STUDENTS = gql`
  query HodAtRiskStudents {
    hodAtRiskStudents {
      id name email submissions avgScorePercent atRisk trend
    }
  }
`;

export const NOTIFICATIONS = gql`
  query Notifications {
    notifications {
      id type title message isRead link createdAt
    }
  }
`;

export const ACTIVITY_LOG = gql`
  query ActivityLog($limit: Int) {
    activityLog(limit: $limit) {
      id action entityType entityTitle aiScore humanScore note timestamp
    }
  }
`;

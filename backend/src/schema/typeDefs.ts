export const typeDefs = /* GraphQL */ `
  scalar DateTime

  enum UserRole { ADMIN FACULTY HOD STUDENT }
  enum AssignmentType { ASSIGNMENT INTERNAL_ASSESSMENT LAB_RECORD DESCRIPTIVE_EXAM }
  enum AssignmentStatus { DRAFT ACTIVE CLOSED ARCHIVED }
  enum SubmissionStatus { SUBMITTED AI_GRADING PENDING_REVIEW APPROVED PUBLISHED }
  enum GradeStatus { AI_DRAFT APPROVED OVERRIDDEN PUBLISHED }

  type User {
    id: ID!
    email: String!
    fullName: String!
    role: UserRole!
    department: String
    createdAt: DateTime!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type RubricCriterion {
    id: ID!
    name: String!
    description: String
    maxMarks: Float!
    order: Int!
  }

  type Rubric {
    id: ID!
    name: String!
    description: String
    totalMarks: Float!
    department: String
    isTemplate: Boolean!
    createdAt: DateTime!
    criteria: [RubricCriterion!]!
  }

  type Assignment {
    id: ID!
    title: String!
    question: String!
    modelAnswer: String!
    assignmentType: AssignmentType!
    status: AssignmentStatus!
    subject: String
    semester: String
    section: String
    isActive: Boolean!
    openDate: DateTime
    dueDate: DateTime
    lateSubmissionPenalty: Float
    instructions: String
    submissionGuidelines: String
    referenceMaterials: String
    notesForStudents: String
    createdAt: DateTime!
    updatedAt: DateTime!
    rubric: Rubric!
    submissionCount: Int!
    pendingReviewCount: Int!
  }

  type Submission {
    id: ID!
    assignmentId: ID!
    studentId: ID!
    answerText: String
    ocrText: String
    status: SubmissionStatus!
    submittedAt: DateTime!
  }

  type SubmissionDetail {
    submissionId: ID!
    studentName: String!
    studentEmail: String!
    answerText: String
    ocrText: String
    submittedAt: DateTime!
    assignmentTitle: String!
    assignmentQuestion: String!
    modelAnswer: String!
  }

  type CriterionScore {
    id: ID!
    criterionId: ID!
    criterionName: String!
    maxMarks: Float!
    aiScore: Float
    finalScore: Float
    comment: String
  }

  type Grade {
    id: ID!
    submissionId: ID!
    aiScore: Float
    finalScore: Float
    aiFeedback: String
    finalFeedback: String
    confidence: Float
    needsReview: Boolean!
    status: GradeStatus!
    reviewedAt: DateTime
    createdAt: DateTime!
    criterionScores: [CriterionScore!]!
  }

  type GradingQueueItem {
    submissionId: ID!
    studentName: String!
    studentEmail: String!
    assignmentTitle: String!
    assignmentId: ID!
    aiScore: Float
    confidence: Float
    needsReview: Boolean!
    status: GradeStatus!
    submittedAt: DateTime!
  }

  type DashboardStats {
    totalAssignments: Int!
    totalSubmissions: Int!
    pendingReview: Int!
    published: Int!
    drafts: Int!
    active: Int!
  }

  type CriterionHeatmap {
    criterion: String!
    avgScore: Float!
    maxMarks: Float!
    percent: Float!
  }

  type ScoreBand {
    range: String!
    count: Int!
  }

  type AssignmentAnalytics {
    totalSubmissions: Int!
    gradedCount: Int!
    avgScore: Float
    maxMarks: Float!
    passRate: Float
    completionRate: Float
    highestScore: Float
    lowestScore: Float
    scoreDistribution: [ScoreBand!]!
    criterionHeatmap: [CriterionHeatmap!]!
    aiHumanAgreementPct: Float
    difficultyLevel: String
  }

  type GeneratedCriterion {
    name: String!
    description: String!
    maxMarks: Float!
  }

  type GeneratedAssignment {
    title: String!
    question: String!
    modelAnswer: String!
    rubricName: String!
    criteria: [GeneratedCriterion!]!
  }

  type GradeExplanation {
    criterionName: String!
    maxMarks: Float!
    score: Float!
    expected: [String!]!
    found: [String!]!
    missing: [String!]!
    justification: String!
  }

  type ExplainGradeResult {
    overallJustification: String!
    aiScore: Float!
    maxMarks: Float!
    criteria: [GradeExplanation!]!
  }

  type StructuredFeedback {
    strengths: [String!]!
    weaknesses: [String!]!
    suggestions: [String!]!
    summary: String!
  }

  type AssignmentTrend {
    assignmentId: ID!
    assignmentTitle: String!
    subject: String
    avgScorePercent: Float!
    passRate: Float!
    gradedCount: Int!
    createdAt: DateTime!
  }

  type MissedConcept {
    concept: String!
    missedByCount: Int!
    totalStudents: Int!
    percent: Float!
    description: String!
  }

  type StudentCriterionScore {
    criterionName: String!
    maxMarks: Float!
    finalScore: Float!
    comment: String
  }

  type StudentSubmissionSummary {
    submissionId: ID!
    assignmentId: ID!
    assignmentTitle: String!
    subject: String
    maxMarks: Float!
    submissionStatus: String!
    submittedAt: DateTime!
    gradeStatus: String
    aiScore: Float
    finalScore: Float
    aiFeedback: String
    finalFeedback: String
    criterionScores: [StudentCriterionScore!]!
  }

  type Notification {
    id: ID!
    type: String!
    title: String!
    message: String!
    isRead: Boolean!
    link: String
    createdAt: DateTime!
  }

  type ActivityLogEntry {
    id: ID!
    action: String!
    entityType: String!
    entityTitle: String!
    aiScore: Float
    humanScore: Float
    note: String
    timestamp: DateTime!
  }

  type StudentDashboard {
    totalSubmissions: Int!
    gradedCount: Int!
    pendingCount: Int!
    avgScorePercent: Float
    upcomingDeadlines: [Assignment!]!
    recentGrades: [StudentSubmissionSummary!]!
    weeklyStreak: Int!
    achievementCount: Int!
  }

  type StudentNotification {
    id: ID!
    type: String!
    title: String!
    message: String!
    isRead: Boolean!
    link: String
    createdAt: DateTime!
  }

  type StudentAnalytics {
    avgScorePercent: Float
    bestScore: Float
    bestAssignment: String
    totalSubmissions: Int!
    gradedCount: Int!
    weeklyScores: [WeeklyScore!]!
    subjectBreakdown: [SubjectScore!]!
  }

  type WeeklyScore {
    week: String!
    avgPercent: Float!
    count: Int!
  }

  type SubjectScore {
    subject: String!
    avgPercent: Float!
    count: Int!
  }

  type PracticeQuestion {
    question: String!
    difficulty: String!
    hint: String!
    sampleAnswer: String!
  }

  type LearningInsight {
    area: String!
    type: String!
    description: String!
    recommendation: String!
    avgPercent: Float!
  }

  type AssignmentOverview {
    difficulty: String!
    estimatedMinutes: Int!
    topics: [String!]!
    objectives: [String!]!
    summary: String!
  }

  type CodeReview {
    complexity: String!
    readability: String!
    edgeCases: [String!]!
    suggestions: [String!]!
    summary: String!
    score: Int!
  }

  type Achievement {
    id: String!
    title: String!
    description: String!
    icon: String!
    earnedAt: DateTime
    earned: Boolean!
  }

  # ─── HOD types ───────────────────────────────
  type HODAdvice {
    summary: String!
    recommendations: [String!]!
    risks: [String!]!
    actionItems: [String!]!
    priority: String!
  }

  type FacultyWorkload {
    id: ID!
    name: String!
    email: String!
    assignments: Int!
    submissions: Int!
    graded: Int!
    pendingReviews: Int!
    avgScorePercent: Float
  }

  type DepartmentStudent {
    id: ID!
    name: String!
    email: String!
    submissions: Int!
    avgScorePercent: Float
    atRisk: Boolean!
    trend: String!
  }

  type SubjectPerformance {
    subject: String!
    avgPercent: Float!
    passRate: Float!
    submissions: Int!
    assignments: Int!
  }

  type HODDashboard {
    department: String!
    facultyCount: Int!
    studentCount: Int!
    assignmentCount: Int!
    submissionCount: Int!
    avgScorePercent: Float
    passRatePercent: Float
    pendingReviews: Int!
    atRiskStudentCount: Int!
    subjectPerformance: [SubjectPerformance!]!
    passTrend: [WeeklyScore!]!
  }

  type QPQuestion {
    number: Int!
    question: String!
    marks: Int!
    bloomLevel: String!
    co: String!
    answerKey: String!
  }
  type BloomBand { level: String! percent: Float! }
  type QuestionPaper {
    title: String!
    subject: String!
    totalMarks: Int!
    durationMinutes: Int!
    instructions: [String!]!
    questions: [QPQuestion!]!
    bloomDistribution: [BloomBand!]!
    evaluationGuidelines: [String!]!
  }

  type BloomDistItem { level: String! count: Int! percent: Float! }
  type BloomValidation {
    distribution: [BloomDistItem!]!
    balanced: Boolean!
    assessment: String!
    suggestions: [String!]!
  }

  type CourseOutcome { co: String! description: String! bloomLevel: String! }
  type COPOEntry { co: String! po: String! strength: Int! }
  type COPOMapping {
    courseOutcomes: [CourseOutcome!]!
    coPoMatrix: [COPOEntry!]!
    justification: String!
  }

  type AccreditationCriterion {
    name: String!
    status: String!
    score: Float!
    evidence: String!
    gaps: [String!]!
  }
  type AccreditationReport {
    framework: String!
    overallReadiness: Float!
    criteria: [AccreditationCriterion!]!
    summary: String!
    priorityActions: [String!]!
  }

  type SkillGap { skill: String! severity: String! affectedPercent: Float! }
  type CompanyTier { tier: String! eligiblePercent: Float! criteria: String! }
  type PlacementReadiness {
    cohortReadiness: Float!
    skillGaps: [SkillGap!]!
    trainingRecommendations: [String!]!
    companyEligibility: [CompanyTier!]!
    summary: String!
  }

  input QuestionInput { text: String! marks: Int! }

  input GenerateAssignmentInput {
    topic: String!
    subject: String
    assignmentType: AssignmentType!
    totalMarks: Float!
    criteriaCount: Int!
  }

  input CriterionInput {
    name: String!
    description: String
    maxMarks: Float!
    order: Int!
  }

  input CreateRubricInput {
    name: String!
    description: String
    totalMarks: Float!
    department: String
    isTemplate: Boolean
    criteria: [CriterionInput!]!
  }

  input CreateAssignmentInput {
    title: String!
    question: String!
    modelAnswer: String!
    assignmentType: AssignmentType!
    status: AssignmentStatus
    subject: String
    semester: String
    section: String
    rubricId: ID!
    openDate: DateTime
    dueDate: DateTime
    lateSubmissionPenalty: Float
    instructions: String
    submissionGuidelines: String
    referenceMaterials: String
    notesForStudents: String
  }

  input UpdateAssignmentInput {
    title: String
    question: String
    modelAnswer: String
    assignmentType: AssignmentType
    subject: String
    semester: String
    section: String
    rubricId: ID
    openDate: DateTime
    dueDate: DateTime
    lateSubmissionPenalty: Float
    instructions: String
    submissionGuidelines: String
    referenceMaterials: String
    notesForStudents: String
  }

  input CriterionOverride {
    criterionId: ID!
    finalScore: Float!
  }

  input ReviewGradeInput {
    action: String!
    finalScore: Float
    finalFeedback: String
    criterionOverrides: [CriterionOverride!]
  }

  type Query {
    me: User
    rubrics: [Rubric!]!
    rubric(id: ID!): Rubric

    assignments: [Assignment!]!
    studentAssignments: [Assignment!]!
    assignment(id: ID!): Assignment

    submissionDetail(submissionId: ID!): SubmissionDetail
    gradingQueue(assignmentId: ID): [GradingQueueItem!]!
    grade(submissionId: ID!): Grade
    studentGrade(submissionId: ID!): Grade
    mySubmission(assignmentId: ID!): Submission
    mySubmissions: [StudentSubmissionSummary!]!
    studentDashboard: StudentDashboard!
    studentNotifications: [StudentNotification!]!
    studentAnalytics: StudentAnalytics!
    learningInsights: [LearningInsight!]!
    studentAchievements: [Achievement!]!
    explainMyGrade(submissionId: ID!): ExplainGradeResult!
    assignmentOverview(assignmentId: ID!): AssignmentOverview!

    explainGrade(submissionId: ID!): ExplainGradeResult!
    performanceTrends: [AssignmentTrend!]!
    topMissedConcepts(assignmentId: ID!): [MissedConcept!]!

    dashboardStats: DashboardStats!
    assignmentAnalytics(assignmentId: ID!): AssignmentAnalytics!

    notifications: [Notification!]!
    activityLog(limit: Int): [ActivityLogEntry!]!

    # ─── HOD queries ───────────────────────────
    hodDashboard: HODDashboard!
    hodFacultyWorkload: [FacultyWorkload!]!
    hodDepartmentStudents: [DepartmentStudent!]!
    hodAtRiskStudents: [DepartmentStudent!]!
  }

  type ChatAction {
    type: String!
    data: String!
  }

  type ChatResponse {
    message: String!
    action: ChatAction
  }

  enum ChatProvider { GROQ OPENROUTER HUGGINGFACE }

  input ChatHistoryItem {
    role: String!
    content: String!
  }

  input ChatInput {
    message: String!
    history: [ChatHistoryItem!]
    pageContext: String
    provider: ChatProvider
  }

  type Mutation {
    register(email: String!, password: String!, fullName: String!, role: UserRole!, department: String): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    refreshToken(token: String!): AuthPayload!

    createRubric(input: CreateRubricInput!): Rubric!
    deleteRubric(id: ID!): Boolean!

    generateAssignment(input: GenerateAssignmentInput!): GeneratedAssignment!
    createAssignment(input: CreateAssignmentInput!): Assignment!
    updateAssignment(id: ID!, input: UpdateAssignmentInput!): Assignment!
    updateAssignmentStatus(id: ID!, status: AssignmentStatus!): Assignment!
    cloneAssignment(id: ID!): Assignment!
    toggleAssignment(id: ID!): Assignment!

    submitAnswer(assignmentId: ID!, answerText: String!): Submission!

    reviewGrade(submissionId: ID!, input: ReviewGradeInput!): Grade!
    publishGrade(submissionId: ID!): Grade!
    bulkApproveGrades(submissionIds: [ID!]!): Int!
    generateFeedback(submissionId: ID!): StructuredFeedback!
    askAssistant(input: ChatInput!): ChatResponse!
    generatePracticeQuestions(topic: String!, subject: String, difficulty: String, count: Int): [PracticeQuestion!]!
    reviewCode(assignmentId: ID!, code: String!, language: String!): CodeReview!

    # ─── HOD AI agents ─────────────────────────
    hodAssistant(query: String!): HODAdvice!
    hodFacultyAllocation(subjects: [String!]!): HODAdvice!
    hodAtRiskAnalysis: HODAdvice!
    hodGenerateQuestionPaper(subject: String!, topics: String!, totalMarks: Int!, questionCount: Int!, examType: String!): QuestionPaper!
    hodValidateBlooms(questions: [QuestionInput!]!): BloomValidation!
    hodGenerateCOPO(subject: String!, topics: String!): COPOMapping!
    hodAccreditationAnalysis(framework: String!): AccreditationReport!
    hodPlacementReadiness: PlacementReadiness!
  }
`;

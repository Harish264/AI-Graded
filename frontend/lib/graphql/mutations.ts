import { gql } from "@apollo/client";

export const REGISTER = gql`
  mutation Register($email: String!, $password: String!, $fullName: String!, $role: UserRole!, $department: String) {
    register(email: $email, password: $password, fullName: $fullName, role: $role, department: $department) {
      accessToken refreshToken user { id email fullName role department createdAt }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken refreshToken user { id email fullName role department createdAt }
    }
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken($token: String!) {
    refreshToken(token: $token) {
      accessToken refreshToken user { id email fullName role }
    }
  }
`;

export const CREATE_RUBRIC = gql`
  mutation CreateRubric($input: CreateRubricInput!) {
    createRubric(input: $input) {
      id name totalMarks criteria { id name maxMarks order }
    }
  }
`;

export const DELETE_RUBRIC = gql`
  mutation DeleteRubric($id: ID!) {
    deleteRubric(id: $id)
  }
`;

export const GENERATE_ASSIGNMENT = gql`
  mutation GenerateAssignment($input: GenerateAssignmentInput!) {
    generateAssignment(input: $input) {
      title question modelAnswer rubricName
      criteria { name description maxMarks }
    }
  }
`;

export const CREATE_ASSIGNMENT = gql`
  mutation CreateAssignment($input: CreateAssignmentInput!) {
    createAssignment(input: $input) {
      id title status assignmentType subject semester section isActive createdAt updatedAt
      rubric { id name totalMarks }
    }
  }
`;

export const UPDATE_ASSIGNMENT = gql`
  mutation UpdateAssignment($id: ID!, $input: UpdateAssignmentInput!) {
    updateAssignment(id: $id, input: $input) {
      id title status assignmentType subject semester section isActive
      openDate dueDate lateSubmissionPenalty
      instructions submissionGuidelines referenceMaterials notesForStudents
      createdAt updatedAt rubric { id name totalMarks }
    }
  }
`;

export const UPDATE_ASSIGNMENT_STATUS = gql`
  mutation UpdateAssignmentStatus($id: ID!, $status: AssignmentStatus!) {
    updateAssignmentStatus(id: $id, status: $status) {
      id status isActive updatedAt
    }
  }
`;

export const CLONE_ASSIGNMENT = gql`
  mutation CloneAssignment($id: ID!) {
    cloneAssignment(id: $id) {
      id title status createdAt
    }
  }
`;

export const TOGGLE_ASSIGNMENT = gql`
  mutation ToggleAssignment($id: ID!) {
    toggleAssignment(id: $id) { id isActive status }
  }
`;

export const SUBMIT_ANSWER = gql`
  mutation SubmitAnswer($assignmentId: ID!, $answerText: String!) {
    submitAnswer(assignmentId: $assignmentId, answerText: $answerText) {
      id status submittedAt
    }
  }
`;

export const REVIEW_GRADE = gql`
  mutation ReviewGrade($submissionId: ID!, $input: ReviewGradeInput!) {
    reviewGrade(submissionId: $submissionId, input: $input) {
      id status finalScore finalFeedback reviewedAt
      criterionScores { id criterionId finalScore }
    }
  }
`;

export const PUBLISH_GRADE = gql`
  mutation PublishGrade($submissionId: ID!) {
    publishGrade(submissionId: $submissionId) { id status }
  }
`;

export const BULK_APPROVE_GRADES = gql`
  mutation BulkApproveGrades($submissionIds: [ID!]!) {
    bulkApproveGrades(submissionIds: $submissionIds)
  }
`;

export const GENERATE_FEEDBACK = gql`
  mutation GenerateFeedback($submissionId: ID!) {
    generateFeedback(submissionId: $submissionId) {
      summary strengths weaknesses suggestions
    }
  }
`;

export const REVIEW_CODE = gql`
  mutation ReviewCode($assignmentId: ID!, $code: String!, $language: String!) {
    reviewCode(assignmentId: $assignmentId, code: $code, language: $language) {
      complexity readability edgeCases suggestions summary score
    }
  }
`;

export const GENERATE_PRACTICE_QUESTIONS = gql`
  mutation GeneratePracticeQuestions($topic: String!, $subject: String, $difficulty: String, $count: Int) {
    generatePracticeQuestions(topic: $topic, subject: $subject, difficulty: $difficulty, count: $count) {
      question difficulty hint sampleAnswer
    }
  }
`;

// ─── HOD AI agents ─────────────────────────────
const HOD_ADVICE_FIELDS = `summary recommendations risks actionItems priority`;

export const HOD_ASSISTANT = gql`
  mutation HodAssistant($query: String!) {
    hodAssistant(query: $query) { ${HOD_ADVICE_FIELDS} }
  }
`;

export const HOD_FACULTY_ALLOCATION = gql`
  mutation HodFacultyAllocation($subjects: [String!]!) {
    hodFacultyAllocation(subjects: $subjects) { ${HOD_ADVICE_FIELDS} }
  }
`;

export const HOD_AT_RISK_ANALYSIS = gql`
  mutation HodAtRiskAnalysis {
    hodAtRiskAnalysis { ${HOD_ADVICE_FIELDS} }
  }
`;

export const HOD_GENERATE_QUESTION_PAPER = gql`
  mutation HodGenerateQuestionPaper($subject: String!, $topics: String!, $totalMarks: Int!, $questionCount: Int!, $examType: String!) {
    hodGenerateQuestionPaper(subject: $subject, topics: $topics, totalMarks: $totalMarks, questionCount: $questionCount, examType: $examType) {
      title subject totalMarks durationMinutes instructions
      questions { number question marks bloomLevel co answerKey }
      bloomDistribution { level percent }
      evaluationGuidelines
    }
  }
`;

export const HOD_VALIDATE_BLOOMS = gql`
  mutation HodValidateBlooms($questions: [QuestionInput!]!) {
    hodValidateBlooms(questions: $questions) {
      distribution { level count percent }
      balanced assessment suggestions
    }
  }
`;

export const HOD_GENERATE_COPO = gql`
  mutation HodGenerateCOPO($subject: String!, $topics: String!) {
    hodGenerateCOPO(subject: $subject, topics: $topics) {
      courseOutcomes { co description bloomLevel }
      coPoMatrix { co po strength }
      justification
    }
  }
`;

export const HOD_ACCREDITATION_ANALYSIS = gql`
  mutation HodAccreditationAnalysis($framework: String!) {
    hodAccreditationAnalysis(framework: $framework) {
      framework overallReadiness summary priorityActions
      criteria { name status score evidence gaps }
    }
  }
`;

export const HOD_PLACEMENT_READINESS = gql`
  mutation HodPlacementReadiness {
    hodPlacementReadiness {
      cohortReadiness summary trainingRecommendations
      skillGaps { skill severity affectedPercent }
      companyEligibility { tier eligiblePercent criteria }
    }
  }
`;

export const ASK_ASSISTANT = gql`
  mutation AskAssistant($input: ChatInput!) {
    askAssistant(input: $input) {
      message
      action { type data }
    }
  }
`;

export type ChatProvider = "GROQ" | "OPENROUTER" | "HUGGINGFACE";

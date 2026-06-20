export const typeDefs = `#graphql
  type Student {
    id: ID!
    name: String!
    email: String!
    status: String!
  }

  type AuthPayload {
    token: String!
    student: Student!
  }

  type PageInfo {
    total: Int!
    limit: Int!
    offset: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  type StudentPage {
    items: [Student!]!
    pageInfo: PageInfo!
  }

  type Course {
    id: ID!
    title: String!
    description: String
    status: String!
    enrolledCount: Int!
    capacity: Int!
    instanceName: String!
  }

  type CoursePage {
    items: [Course!]!
    pageInfo: PageInfo!
  }

  type Enrollment {
    id: Int!
    studentId: Int!
    courseId: Int!
    status: String!
    createdAt: String
    updatedAt: String
    student: Student
    course: Course
  }

  type ChatConversation {
    id: ID!
    type: String!
    createdAt: String
    updatedAt: String
  }

  type ChatMessage {
    id: ID!
    conversationId: ID!
    senderId: ID!
    content: String!
    createdAt: String
  }

  type EnrollmentPage {
    items: [Enrollment!]!
    pageInfo: PageInfo!
  }

  type Query {
    student(id: ID!): Student
    me: Student
    students(limit: Int, offset: Int): [Student!]!
    studentsPage(limit: Int, offset: Int): StudentPage!
    course(id: ID!): Course
    courses(limit: Int, offset: Int): [Course!]!
    coursesPage(limit: Int, offset: Int): CoursePage!
    topCourses(limit: Int = 10): [Course!]!
    enrollment(id: Int!): Enrollment
    enrollments(limit: Int, offset: Int): [Enrollment!]!
    enrollmentsPage(limit: Int, offset: Int): EnrollmentPage!
    myConversations: [ChatConversation!]!
    chatMessages(conversationId: ID!, limit: Int = 50, before: String): [ChatMessage!]!
  }

  type Subscription {
    chatMessageAdded(conversationId: ID!): ChatMessage
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createStudent(input: CreateStudentInput!): Student!
    createEnrollment(input: CreateEnrollmentInput!): Enrollment!
    getOrCreateDirectConversation(targetStudentId: ID!): ChatConversation!
    sendChatMessage(conversationId: ID!, content: String!): ChatMessage!
  }

  input CreateStudentInput {
    name: String!
    email: String!
    password: String!
  }

  input CreateEnrollmentInput {
    studentId: Int!
    courseId: Int!
  }
`;
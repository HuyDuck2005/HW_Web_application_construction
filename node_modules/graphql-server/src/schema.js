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
    id: Int!
    title: String!
    description: String
    status: String!
    enrolledCount: Int!
    capacity: Int!
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

  type EnrollmentPage {
    items: [Enrollment!]!
    pageInfo: PageInfo!
  }

  type Query {
    student(id: ID!): Student
    me: Student
    students(limit: Int, offset: Int): [Student!]!
    studentsPage(limit: Int, offset: Int): StudentPage!
    course(id: Int!): Course
    courses(limit: Int, offset: Int): [Course!]!
    coursesPage(limit: Int, offset: Int): CoursePage!
    enrollment(id: Int!): Enrollment
    enrollments(limit: Int, offset: Int): [Enrollment!]!
    enrollmentsPage(limit: Int, offset: Int): EnrollmentPage!
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createStudent(input: CreateStudentInput!): Student!
    createEnrollment(input: CreateEnrollmentInput!): Enrollment!
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

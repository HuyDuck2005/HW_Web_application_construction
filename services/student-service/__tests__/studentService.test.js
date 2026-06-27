import bcrypt from "bcryptjs";
import { describe, expect, jest, test, beforeEach } from "@jest/globals";
import { createStudentService } from "../src/studentService.js";

// Mock repository cho việc kiểm thử
function createMockRepository() {
  return {
    create: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    countAll: jest.fn(),
    findByIds: jest.fn(),
  };
}

describe("student-service createStudent", () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = createMockRepository();
    service = createStudentService(repository);
  });

  test("throws INVALID_ARGUMENT when registration data is missing", async () => {
    await expect(
      service.createStudent({
        name: "Nguyen Van A",
        email: "student@example.com",
      })
    ).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
      message: "Name, email and password are required",
    });

    expect(repository.findByEmailWithPassword).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  test("throws ALREADY_EXISTS when registering with an existing email", async () => {
    repository.findByEmailWithPassword.mockResolvedValue({
      id: "student-1",
      email: "student@example.com",
    });

    await expect(
      service.createStudent({
        name: "Nguyen Van A",
        email: "student@example.com",
        password: "secret123",
      })
    ).rejects.toMatchObject({
      code: "ALREADY_EXISTS",
      message: "Email already exists",
    });

    expect(repository.findByEmailWithPassword).toHaveBeenCalledWith(
      "student@example.com"
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  test("creates a student with a hashed password", async () => {
    repository.findByEmailWithPassword.mockResolvedValue(null);
    repository.create.mockImplementation(async (student) => ({
     id: student.id, // Đảm bảo trường này được trả về
    name: student.name,
    email: student.email,
    password: student.password, // Giữ lại để test bcrypt phía dưới
    status: "ACTIVE",
    }));

    const result = await service.createStudent({
      id: "student-1",
      name: "Nguyen Van A",
      email: "student@example.com",
      password: "secret123",
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    const savedStudent = repository.create.mock.calls[0][0];
    
    expect(savedStudent).toMatchObject({
      id: "student-1",
      name: "Nguyen Van A",
      email: "student@example.com",
    });
    
    // Kiểm tra password đã được hash
    expect(savedStudent.password).not.toBe("secret123");
    await expect(
      bcrypt.compare("secret123", savedStudent.password)
    ).resolves.toBe(true);

    expect(result).toEqual({
      id: "student-1",
      name: "Nguyen Van A",
      email: "student@example.com",
      status: "ACTIVE",
    });
  });
});

describe("student-service authenticateStudent", () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = createMockRepository();
    service = createStudentService(repository);
  });

  test("returns success and student info when email and password are valid", async () => {
    const passwordHash = await bcrypt.hash("secret123", 10);
    repository.findByEmailWithPassword.mockResolvedValue({
      id: "student-1",
      name: "Nguyen Van A",
      email: "student@example.com",
      password: passwordHash,
      status: "ACTIVE",
    });

    await expect(
      service.authenticateStudent({
        email: "student@example.com",
        password: "secret123",
      })
    ).resolves.toEqual({
      success: true,
      student: {
        id: "student-1",
        name: "Nguyen Van A",
        email: "student@example.com",
      },
      message: "Authenticated",
    });

    expect(repository.findByEmailWithPassword).toHaveBeenCalledWith(
      "student@example.com"
    );
  });

  test("returns failure when email does not exist", async () => {
    repository.findByEmailWithPassword.mockResolvedValue(null);

    await expect(
      service.authenticateStudent({
        email: "missing@example.com",
        password: "secret123",
      })
    ).resolves.toEqual({
      success: false,
      student: null,
      message: "Invalid email or password",
    });
  });

  test("returns failure when password is invalid", async () => {
    const passwordHash = await bcrypt.hash("secret123", 10);
    repository.findByEmailWithPassword.mockResolvedValue({
      id: "student-1",
      name: "Nguyen Van A",
      email: "student@example.com",
      password: passwordHash,
      status: "ACTIVE",
    });

    await expect(
      service.authenticateStudent({
        email: "student@example.com",
        password: "wrong-password",
      })
    ).resolves.toEqual({
      success: false,
      student: null,
      message: "Invalid email or password",
    });
  });
});

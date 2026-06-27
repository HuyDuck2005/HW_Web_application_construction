# Web Application Architecture Project

Dự án này là một kiến trúc ứng dụng web hiện đại, được xây dựng theo mô hình Microservices với các công nghệ backend mạnh mẽ.

## 🚀 Tổng quan kiến trúc
Dự án được thiết kế để đảm bảo tính mở rộng, khả năng chịu lỗi và hiệu suất cao thông qua:
* **Microservices:** Phân tách các nghiệp vụ thành các service độc lập (`chat-service`, `course-service`, `enrollment-service`, `notification-service`, `student-service`).
* **G通讯 (gRPC):** Giao tiếp giữa các service nhanh chóng và hiệu quả.
* **GraphQL:** Cung cấp API linh hoạt cho frontend.
* **Event-Driven Architecture:** Sử dụng RabbitMQ để xử lý các sự kiện bất đồng bộ giữa các service.
* **Database & Caching:** Sử dụng PostgreSQL và Redis để lưu trữ và tăng tốc độ truy vấn.
* **Containerization & Orchestration:** Hỗ trợ Docker và Kubernetes (k8s) để triển khai dễ dàng.

## 🛠 Công nghệ sử dụng
* **Runtime:** Node.js
* **Communication:** gRPC, GraphQL, RabbitMQ
* **Database:** PostgreSQL (Knex.js)
* **Infrastructure:** Docker, Kubernetes (k8s), Redis
* **Tooling:** Jest (Testing)

## 📋 Cấu trúc thư mục
```text
.
├── graphql-server/      # Gateway GraphQL
├── services/            # Các microservices độc lập
├── k8s/                 # Cấu hình triển khai Kubernetes
├── protos/              # Định nghĩa các tệp gRPC proto
├── nginx/               # Cấu hình Nginx reverse proxy
└── scripts/             # Các tệp kịch bản hỗ trợ

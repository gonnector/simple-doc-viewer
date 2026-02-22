# Mermaid 다이어그램 테스트

이 문서는 Mermaid가 지원하는 다양한 다이어그램 유형을 테스트합니다.

---

## 1. Flowchart

```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[Result]
    D --> E
    E --> F[End]
```

## 2. Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant DB

    Client->>Server: HTTP Request
    Server->>DB: Query
    DB-->>Server: Result
    Server-->>Client: JSON Response
    Client->>Client: Render UI
```

## 3. Class Diagram

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
    }
    class Dog {
        +String breed
        +fetch() void
    }
    class Cat {
        +bool isIndoor
        +purr() void
    }
    Animal <|-- Dog
    Animal <|-- Cat
```

## 4. State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : Start
    Processing --> Success : Complete
    Processing --> Error : Fail
    Error --> Idle : Retry
    Success --> [*]
```

## 5. Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ POST : writes
    USER ||--o{ COMMENT : writes
    POST ||--o{ COMMENT : has
    POST ||--o{ TAG : tagged
    USER {
        int id PK
        string name
        string email
    }
    POST {
        int id PK
        string title
        text content
    }
```

## 6. Gantt Chart

```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Design
        Requirements : done, 2026-01-01, 2026-01-15
        Prototyping  : done, 2026-01-10, 2026-01-25
    section Development
        Backend      : active, 2026-01-20, 2026-02-15
        Frontend     :         2026-02-01, 2026-02-28
    section Testing
        QA           :         2026-02-15, 2026-03-10
```

## 7. Pie Chart

```mermaid
pie title Language Usage
    "JavaScript" : 40
    "Python" : 25
    "TypeScript" : 20
    "Go" : 10
    "Other" : 5
```

## 8. Mindmap

```mermaid
mindmap
  root((Project))
    Frontend
      React
      CSS
      HTML
    Backend
      Node.js
      Database
      API
    DevOps
      CI/CD
      Docker
      Monitoring
```

## 9. Git Graph

```mermaid
gitGraph
    commit
    commit
    branch feature
    checkout feature
    commit
    commit
    checkout main
    merge feature
    commit
    branch hotfix
    checkout hotfix
    commit
    checkout main
    merge hotfix
```

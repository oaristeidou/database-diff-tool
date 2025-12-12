Database Diff Tool (Quarkus + Angular)

Overview
- Quarkus backend connects to two Oracle databases, compares a given table by a key column, and returns JSON describing added, removed, and changed rows.
- Angular frontend lets you enter schema, table, and key column, calls the backend, and renders a simple diff view.

Backend (Quarkus)
- Location: backend-quarkus
- REST endpoint: GET /api/diff?schema=SCHEMA&table=TABLE&key=KEY_COLUMN
- CORS enabled for local dev

Build and run (packaged JAR)
- We configured Quarkus to use Fast JAR packaging so the runnable JAR is always created at target/quarkus-app/quarkus-run.jar after packaging.
- Steps:
  1) cd backend-quarkus
  2) mvn clean package
  3) java -jar target/quarkus-app/quarkus-run.jar

Dev mode (hot reload)
- Alternatively, run the backend in dev mode (no packaged jar needed):
  1) cd backend-quarkus
  2) mvn quarkus:dev

Configure environment (examples)
- DB1_JDBC_URL (default: jdbc:oracle:thin:@//localhost:1521/ORCLCDB)
- DB1_USERNAME (default: system)
- DB1_PASSWORD (default: oracle)
- DB2_JDBC_URL (default: jdbc:oracle:thin:@//localhost:1522/ORCLCDB)
- DB2_USERNAME (default: system)
- DB2_PASSWORD (default: oracle)
- PORT (default: 8080)

Build and run (dev)
1) cd backend-quarkus
2) mvn quarkus:dev

Example request
http://localhost:8080/api/diff?schema=HR&table=EMPLOYEES&key=EMPLOYEE_ID

Frontend (Angular)
- Location: frontend-angular
- Angular version: 19.x
- Start dev server
  1) cd frontend-angular
  2) npm install
  3) npm start (serves at http://localhost:4200)
- By default the frontend calls http://localhost:8080. To change, define window.BACKEND_BASE_URL in index.html before main.js.

Notes / Limitations
- Loads entire table from both DBs. For large tables add filtering/pagination/hashing on backend.
- Requires a single key column (no composite keys in this minimal version).
- BLOB/CLOB shown as placeholders. Temporal values are stringified.

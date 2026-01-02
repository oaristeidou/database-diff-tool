-- Initialize mock Oracle DB #2 with five comparable tables and seed data
-- This DB contains intentional differences vs DB #1 to exercise the diff tool.

-- Ensure we operate under SYSTEM schema (script is executed by the base image in the PDB context)
BEGIN
  EXECUTE IMMEDIATE 'ALTER SESSION SET CURRENT_SCHEMA = SYSTEM';
END;
/

-- Helper to drop table if it exists
CREATE OR REPLACE PROCEDURE drop_table_if_exists(p_owner VARCHAR2, p_table VARCHAR2) AS
  v_cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_cnt
  FROM all_tables
  WHERE owner = UPPER(p_owner) AND table_name = UPPER(p_table);
  IF v_cnt > 0 THEN
    EXECUTE IMMEDIATE 'DROP TABLE ' || p_owner || '.' || p_table || ' PURGE';
  END IF;
END;
/

BEGIN drop_table_if_exists('SYSTEM', 'CUSTOMERS'); END;
/
BEGIN drop_table_if_exists('SYSTEM', 'PRODUCTS'); END;
/
BEGIN drop_table_if_exists('SYSTEM', 'ORDERS'); END;
/
BEGIN drop_table_if_exists('SYSTEM', 'EMPLOYEES'); END;
/
BEGIN drop_table_if_exists('SYSTEM', 'DEPARTMENTS'); END;
/

-- CUSTOMERS
CREATE TABLE SYSTEM.CUSTOMERS (
  ID        NUMBER         PRIMARY KEY,
  NAME      VARCHAR2(100)  NOT NULL,
  EMAIL     VARCHAR2(150),
  CREATED_AT DATE DEFAULT SYSDATE
);

-- PRODUCTS
CREATE TABLE SYSTEM.PRODUCTS (
  ID        NUMBER        PRIMARY KEY,
  NAME      VARCHAR2(100) NOT NULL,
  PRICE     NUMBER(10,2)  NOT NULL,
  ACTIVE    CHAR(1)       DEFAULT 'Y' CHECK (ACTIVE IN ('Y','N'))
);

-- ORDERS
CREATE TABLE SYSTEM.ORDERS (
  ID          NUMBER        PRIMARY KEY,
  CUSTOMER_ID NUMBER        NOT NULL,
  PRODUCT_ID  NUMBER        NOT NULL,
  QTY         NUMBER        NOT NULL,
  ORDER_DATE  DATE          NOT NULL,
  STATUS      VARCHAR2(20)  NOT NULL,
  CONSTRAINT FK_ORDERS_CUSTOMER FOREIGN KEY (CUSTOMER_ID) REFERENCES SYSTEM.CUSTOMERS(ID),
  CONSTRAINT FK_ORDERS_PRODUCT  FOREIGN KEY (PRODUCT_ID)  REFERENCES SYSTEM.PRODUCTS(ID)
);

-- EMPLOYEES
CREATE TABLE SYSTEM.EMPLOYEES (
  ID         NUMBER         PRIMARY KEY,
  FIRST_NAME VARCHAR2(50)   NOT NULL,
  LAST_NAME  VARCHAR2(50)   NOT NULL,
  DEPT_ID    NUMBER,
  HIRED_AT   DATE
);

-- DEPARTMENTS
CREATE TABLE SYSTEM.DEPARTMENTS (
  ID     NUMBER        PRIMARY KEY,
  NAME   VARCHAR2(100) NOT NULL,
  REGION VARCHAR2(50)
);

-- Seed data for DB2 (intentionally different from DB1)
-- Departments: change region for Sales, remove HR, add Support
INSERT INTO SYSTEM.DEPARTMENTS (ID, NAME, REGION) VALUES (10, 'Engineering', 'EU');
INSERT INTO SYSTEM.DEPARTMENTS (ID, NAME, REGION) VALUES (20, 'Sales', 'APAC');
INSERT INTO SYSTEM.DEPARTMENTS (ID, NAME, REGION) VALUES (40, 'Support', 'NA');

-- Employees: update Bob's dept, remove Carol, add Dave
INSERT INTO SYSTEM.EMPLOYEES (ID, FIRST_NAME, LAST_NAME, DEPT_ID, HIRED_AT) VALUES (1, 'Alice', 'Smith', 10, DATE '2020-01-10');
INSERT INTO SYSTEM.EMPLOYEES (ID, FIRST_NAME, LAST_NAME, DEPT_ID, HIRED_AT) VALUES (2, 'Bob',   'Johnson', 10, DATE '2019-05-03');
INSERT INTO SYSTEM.EMPLOYEES (ID, FIRST_NAME, LAST_NAME, DEPT_ID, HIRED_AT) VALUES (4, 'Dave',  'Miller', 40, DATE '2022-11-11');

-- Customers: change Fabrikam email, remove Northwind, add AdventureWorks
INSERT INTO SYSTEM.CUSTOMERS (ID, NAME, EMAIL, CREATED_AT) VALUES (1, 'Contoso Ltd', 'contact@contoso.com', DATE '2022-01-01');
INSERT INTO SYSTEM.CUSTOMERS (ID, NAME, EMAIL, CREATED_AT) VALUES (2, 'Fabrikam Inc', 'support@fabrikam.com', DATE '2022-02-02');
INSERT INTO SYSTEM.CUSTOMERS (ID, NAME, EMAIL, CREATED_AT) VALUES (4, 'AdventureWorks', 'sales@adventure-works.com', DATE '2022-04-04');

-- Products: change Widget price, deactivate Gadget, remove Doohickey, add Thingamajig
INSERT INTO SYSTEM.PRODUCTS (ID, NAME, PRICE, ACTIVE) VALUES (100, 'Widget', 10.99, 'Y');
INSERT INTO SYSTEM.PRODUCTS (ID, NAME, PRICE, ACTIVE) VALUES (101, 'Gadget', 19.99, 'N');
INSERT INTO SYSTEM.PRODUCTS (ID, NAME, PRICE, ACTIVE) VALUES (103, 'Thingamajig', 7.25, 'Y');

-- Orders: change status for 1001, remove 1002, add 1003 for new customer/product
INSERT INTO SYSTEM.ORDERS (ID, CUSTOMER_ID, PRODUCT_ID, QTY, ORDER_DATE, STATUS) VALUES (1000, 1, 100, 3, DATE '2023-01-15', 'OPEN');
INSERT INTO SYSTEM.ORDERS (ID, CUSTOMER_ID, PRODUCT_ID, QTY, ORDER_DATE, STATUS) VALUES (1001, 2, 101, 1, DATE '2023-02-20', 'DELIVERED');
INSERT INTO SYSTEM.ORDERS (ID, CUSTOMER_ID, PRODUCT_ID, QTY, ORDER_DATE, STATUS) VALUES (1003, 4, 103, 2, DATE '2023-04-05', 'OPEN');

COMMIT;

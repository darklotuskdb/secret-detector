# 🔐 Secret Detector — Caido Plugin

**Secret Detector** is a backend plugin for [Caido](https://caido.io) that scans HTTP responses for **hardcoded secrets** such as API keys, passwords, tokens, and encryption keys. It classifies findings by severity — `Low`, `Medium`, and `High` — to help prioritize issues during security assessments.

---

## ✨ Features

- ✅ Monitors **live HTTP traffic**
- ✅ Detects **high-risk secrets** (e.g. `AWS_SECRET_KEY`, `db_password`)
- ✅ Classifies findings by **severity**
- ✅ Logs results in **Caido Findings**
- ✅ Built for **speed and maintainability**
- ✅ Extensible — add more keywords easily

---

## 🚀 Screenshot


---

## 🔍 What It Detects

The plugin scans for keys like:

### 🔴 High Severity
- `aws_secret_key`
- `private_key`
- `client_secret`
- `db_password`
- `encryption_key`
- …and many more

### 🟠 Medium Severity
- `access_token`
- `firebase_token`
- `deploy_password`
- `auth_token`
- …and many more

### 🟢 Low Severity
- `api_key`
- `app_key`
- `bucket`
- `public_key`
- …and many more




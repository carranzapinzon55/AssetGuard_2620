# 🛡️ AssetGuard_2620

[![Java](https://img.shields.io/badge/Java-17%2B-ED8B00?logo=openjdk&logoColor=white)](https://www.java.com/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x%20%2F%204.x-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![GraphQL](https://img.shields.io/badge/API-GraphQL-E10098?logo=graphql&logoColor=white)](https://graphql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

AssetGuard 2620 es una plataforma corporativa desarrollada para **GlobalNet Telecom** para centralizar la gestión de inventario tecnológico, el control estricto del ciclo de vida de custodias, inspecciones técnicas, mantenimientos y auditoría de trazabilidad operativa bajo un modelo de seguridad basado en roles (RBAC).

---

## 🏛️ Arquitectura del Sistema

* **Backend — Arquitectura Hexagonal (Ports & Adapters):** Desarrollado en Java con Spring Boot. El núcleo de negocio (dominio y casos de uso) permanece desacoplado de los adaptadores de entrada (GraphQL Controllers y endpoints REST de soporte) y de salida (Spring Data JPA, PostgreSQL y servicios de token JWT). La API GraphQL opera en `/graphql` y dispone de consola interactiva en `/graphiql`.
* **Frontend — Next.js App Router:** Aplicación web moderna construida con React, TypeScript y Tailwind CSS. Implementa un route handler proxy interno en `/api/graphql` hacia el backend en `http://127.0.0.1:8080/graphql`, resolviendo CORS y encapsulando las peticiones seguras.
* **Persistencia y Datos:** Base de datos relacional PostgreSQL modelada en Tercera Forma Normal (3FN), con nomenclatura técnica íntegramente en inglés.

---

## 👥 Matriz de Roles y Alcance (RBAC)

| Rol | Identificador | Alcance Operativo en la Plataforma |
|---|---|---|
| **Director de Logística** | `ADMIN` | Gestión integral de usuarios, sucursales, dashboard financiero/mermas, carga masiva de inventario y consulta de auditoría global. |
| **Encargado de Bodega** | `INSPECTOR` | Aprobación y rechazo de préstamos solicitados, recepción física y certificación de retornos (buen estado, daño o pérdida), y envío de equipos a mantenimiento. |
| **Técnico en Campo** | `TECHNICIAN` | Consulta del catálogo de activos tecnológicos disponibles, registro de solicitudes de préstamo y consulta de su historial personal de custodias. |

---

## 🔑 Credenciales de Prueba y Datos Precargados (Seeders)

El sistema inicializa automáticamente las identidades de prueba al arrancar para facilitar la evaluación de los tres roles:

| Rol | Correo Electrónico | Contraseña | Propósito de Prueba |
|---|---|---|---|
| `ADMIN` | `admin@globalnet.com` | `12345` | Pruebas de administración general, métricas y carga masiva. |
| `INSPECTOR` | `dayis@gmail.com` | `12345` | Pruebas de aprobación/rechazo de préstamos y recepción de equipos. |
| `TECHNICIAN` | `carlos12345@gmail.com` | `12345` | Pruebas de solicitud de activos y vista de historial personal. |
| `TECHNICIAN` | `nicole@gmail.com` | `12345` | Consulta de préstamos en curso y solicitudes pendientes. |

---

## 📋 Requisitos Previos del Entorno

| Componente | Versión Recomendada | Notas de Entorno |
|---|---|---|
| **Java JDK** | **17 LTS** o **21 LTS** | Declarado en `backend/pom.xml`. Probado en Eclipse Temurin JDK 21. |
| **Maven** | **3.8+** / **3.9+** | Gestor de dependencias y empaquetado del backend. |
| **PostgreSQL** | **14+** (óptimo 16 o 17) | Servidor de base de datos relacional. |
| **Node.js** | **v20.9.0+ LTS** | Requerido por Next.js 16. Probado en Node v20 / v26. |
| **pnpm** | **9.x** / **12.x** | Gestor de paquetes oficial del proyecto (`pnpm-lock.yaml`). |
| **npm** | **10.x+** | Alternativa compatible para levantar el frontend. |

---

## ⚙️ Variables de Entorno y Configuración

### Backend (`backend/src/main/resources/application.yml`)

El backend expone variables de entorno configurables con valores locales por defecto:

```yaml
# application.yml.example
spring:
  application:
    name: AssetGuard_2620
  graphql:
    graphiql:
      enabled: true
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/asset_guard_db}
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:luisito2425d}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
security:
  jwt:
    secret: ${JWT_SECRET:claveSecretaSuperSeguraAssetGuard2026PorDefecto123456}
    expiration-ms: ${JWT_EXPIRATION_MS:3600000}
server:
  port: 8080
# AssetGuard_2620

[![Java](https://img.shields.io/badge/Java-17%2B-ED8B00?logo=openjdk&logoColor=white)](https://www.java.com/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.1-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![GraphQL](https://img.shields.io/badge/API-GraphQL-E10098?logo=graphql&logoColor=white)](https://graphql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

AssetGuard 2620 es una plataforma interna de GlobalNet Telecom para administrar inventario tecnológico, asignaciones y devoluciones de equipos, mantenimiento y auditorías de custodia. La interfaz ofrece flujos diferenciados para los roles **ADMIN**, **INSPECTOR** y **TECHNICIAN**.

## Arquitectura

- **Backend — arquitectura hexagonal:** aplicación Java con Spring Boot. El dominio y los casos de uso se mantienen separados de los adaptadores de entrada (GraphQL y controladores REST) y de salida (persistencia JPA/PostgreSQL, seguridad y carga de archivos). La API GraphQL se publica en `/graphql`; GraphiQL está habilitado por configuración.
- **Frontend — Next.js App Router:** aplicación React y TypeScript con rutas de workspace, componentes interactivos y estilos Tailwind CSS 4 junto con hojas de estilo propias. El cliente web envía sus operaciones a `/api/graphql`, una ruta de Next.js que las reenvía al backend local en `http://127.0.0.1:8080/graphql`.
- **Persistencia:** Spring Data JPA e Hibernate con PostgreSQL. El esquema se actualiza al arrancar (ver [Migración de base de datos](#migración-y-aprovisionamiento-de-base-de-datos)).

## Requisitos previos

| Componente | Versión requerida o detectada |
|---|---|
| Java JDK | **17** es el objetivo declarado en `backend/pom.xml`. JDK 17 o posterior; en el entorno de desarrollo se detectó Temurin **21.0.13 LTS**. |
| Maven | Maven **3.x**; en el entorno de desarrollo se detectó **3.10.0**. Hay lanzadores `mvnw`/`mvnw.cmd`, pero no está presente `.mvn/wrapper/maven-wrapper.properties`; para este checkout, use Maven instalado. |
| PostgreSQL | **14 o posterior** recomendado. El repositorio no fija una versión del servidor; usa el driver JDBC de PostgreSQL y el dialecto PostgreSQL de Hibernate. |
| Node.js | **20.9.0 o posterior**, requisito de Next.js 16.4.3. Se detectó Node.js **v26.13.0** en el entorno de desarrollo. |
| pnpm | Versión declarada por el proyecto: **12.4.1** (`frontend/package.json`). |
| npm (alternativa) | Se detectó npm **11.20.0**. El lockfile oficial del frontend es `pnpm-lock.yaml`; pnpm ofrece instalaciones reproducibles. |

El backend usa Spring Boot **4.1.1**. El frontend declara Next.js **16.4.3**, React/React DOM **19.3.0**, TypeScript **5** y Tailwind CSS **4**.

## Variables de entorno

No se incluyen archivos `.env.example` ni `application.yml.example` en el repositorio. Los bloques de abajo documentan las variables que reconoce el código y sirven como plantillas para esos archivos o para configurar el entorno local. No guardes contraseñas ni secretos reales en Git.

### Backend

`backend/src/main/resources/application.yml` lee estas variables de entorno:

| Variable | Uso | Valor local de ejemplo |
|---|---|---|
| `DB_URL` | URL JDBC de PostgreSQL | `jdbc:postgresql://localhost:5432/asset_guard_db` |
| `DB_USERNAME` | Usuario de la base de datos | `assetguard` |
| `DB_PASSWORD` | Contraseña de ese usuario | `cambiar-por-un-secreto-local` |
| `JWT_SECRET` | Clave de firma JWT | `reemplazar-por-una-clave-segura-de-al-menos-32-bytes` |
| `JWT_EXPIRATION_MS` | Vigencia del token en milisegundos | `3600000` (1 hora) |

La configuración YAML equivalente es:

```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/asset_guard_db}
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: update
security:
  jwt:
    secret: ${JWT_SECRET}
    expiration-ms: ${JWT_EXPIRATION_MS:3600000}
```

Spring Boot también admite pasar estas variables como opciones `-D...` o mediante la configuración de ejecución del IDE. En PowerShell, por ejemplo, antes de iniciar el backend:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/asset_guard_db"
$env:DB_USERNAME = "assetguard"
$env:DB_PASSWORD = "cambiar-por-un-secreto-local"
$env:JWT_SECRET = "reemplazar-por-una-clave-segura-de-al-menos-32-bytes"
$env:JWT_EXPIRATION_MS = "3600000"
```

`application.yml` contiene valores predeterminados de desarrollo para la conexión y la firma JWT. Configura explícitamente las variables anteriores, en particular `DB_PASSWORD` y `JWT_SECRET`; no uses esos valores predeterminados en un entorno compartido o de producción.

### Frontend

Next.js carga variables de `.env.local` desde `frontend/`. Como plantilla equivalente a `.env.example` o `.env.local.example`, el archivo puede contener:

```dotenv
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3000/api/graphql
```

En el navegador, el cliente GraphQL usa el mismo origen y llama a `/api/graphql`. La ruta proxy actual reenvía al backend en `http://127.0.0.1:8080/graphql`; `NEXT_PUBLIC_GRAPHQL_URL` se usa como URL alternativa del cliente cuando se ejecuta en servidor y **no configura la URL de destino del proxy**. Para cambiar el destino del proxy hay que actualizar `frontend/src/app/api/graphql/route.ts`.

## Inicialización y aprovisionamiento de base de datos

1. Instala PostgreSQL y asegúrate de que el servicio esté activo.
2. Crea la base de datos y un usuario de desarrollo. Por ejemplo, desde `psql` como un administrador de PostgreSQL:

   ```sql
   CREATE USER assetguard WITH PASSWORD 'cambiar-por-un-secreto-local';
   CREATE DATABASE asset_guard_db OWNER assetguard;
   ```

3. Configura `DB_URL`, `DB_USERNAME` y `DB_PASSWORD` en el entorno donde iniciarás Spring Boot.
4. Al arrancar, Spring Data JPA/Hibernate crea o actualiza las tablas a partir de las entidades gracias a `spring.jpa.hibernate.ddl-auto: update`.

El proyecto no contiene scripts SQL versionados ni utiliza Flyway/Liquibase. `ddl-auto: update` es un mecanismo de desarrollo y no sustituye una estrategia de migraciones versionadas para producción. Realiza copias de seguridad antes de actualizar esquemas con datos importantes.

En el primer arranque, `DefaultAdminInitializer` crea el usuario inicial `admin@globalnet.com` con contraseña `12345` si no existe. **Esas credenciales son únicamente para desarrollo local:** cambia la contraseña inmediatamente y no expongas la instancia mientras sigan vigentes. El inicializador no reemplaza ni restablece la contraseña si la cuenta ya existe.

## Ejecución local

### 1. Iniciar el backend

Desde la raíz del repositorio:

```bash
cd backend
mvn spring-boot:run
```

El servicio escucha en `http://localhost:8080`. GraphQL está disponible en `http://localhost:8080/graphql`; la interfaz GraphiQL está habilitada en la configuración del proyecto.

Para compilar y ejecutar las pruebas del backend:

```bash
cd backend
mvn test
```

### 2. Iniciar el frontend

En otra terminal, desde la raíz:

```bash
cd frontend
pnpm install
pnpm dev
```

Abre `http://localhost:3000`. Crea `frontend/.env.local` si necesitas definir `NEXT_PUBLIC_GRAPHQL_URL`.

Alternativa usando npm:

```bash
cd frontend
npm install
npm run dev
```

La instalación con npm puede generar un `package-lock.json`; el lockfile mantenido en el repositorio es `pnpm-lock.yaml`.

## Funcionalidades principales

- Inventario de activos y carga masiva de archivos CSV/XLSX.
- Solicitudes, aprobación, rechazo y registro de devoluciones de préstamos.
- Mantenimiento de activos y certificación de retorno al inventario.
- Historial personal de custodias y auditoría con filtros.
- Gestión de usuarios y permisos según el rol.
- Autenticación sin estado con JWT.

## Validación del frontend

Desde `frontend/`:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Con npm se pueden usar los equivalentes `npm run lint`, `npx tsc --noEmit` y `npm run build`.

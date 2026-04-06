# Payment-Tracker

Sistema de seguimiento de pagos de clientes. Aplicacion web serverless construida con HTML, Tailwind CSS, JavaScript vanilla y Firebase.

## Tech Stack

- **Frontend:** HTML5, Tailwind CSS (CDN), JavaScript ES6+ (sin frameworks)
- **Backend/DB:** Firebase Firestore (real-time)
- **Autenticacion:** Firebase + localStorage para sesion
- **Hosting:** No requiere servidor — 100% frontend

## Estructura del Proyecto

```
Payment-Tracker/
├── index.html    — UI completa: login, header, tabs, dashboard, modales
├── app.js        — Toda la logica: auth, Firebase, CRUD, renderizado
└── README.md
```

## Funcionalidades Principales

### Autenticacion y Roles
- Dos roles: **Admin** y **Operador**
- Admin aprueba/rechaza registros y puede resetear password del operador
- Operador crea registros que quedan en estado "pendiente" hasta aprobacion
- Sesion persistida en localStorage (`pt_session`)
- Reseteo de password tras 5 intentos fallidos

### Dashboard
- 6 tarjetas KPI: monto total, cobrado, pendiente, progreso global, clientes unicos, transacciones
- Tarjetas por cliente con barra de progreso y desglose por factura
- Estatus visual: completado, parcial, sin pago

### Gestion de Clientes
- Crear clientes con factura inicial
- Agregar facturas a clientes existentes
- Renombrar clientes (actualiza todas las facturas asociadas)
- Eliminar clientes con borrado en cascada de facturas y pagos
- Sugerencia automatica de numero de factura

### Gestion de Facturas
- CRUD completo de facturas (cliente, numero, fecha, monto, notas)
- Prevencion de facturas duplicadas por cliente
- Estados: Pendiente, Parcial, Pagado

### Gestion de Pagos (Abonos)
- Registrar pagos contra facturas con: fecha, monto, cuenta destino, esquema de pago
- Esquemas: Asimilados, Prestamo x Mutuo, Efectivo, Transferencia a Terceros, Otros
- Cuentas destino configuradas (ej. BBVA Cahen, Caja)
- Historial de pagos por factura en modal
- Estados de pago: Aprobado, Pendiente, Pendiente Borrar

### Sistema de Aprobacion (Workflow)
- Badge de pendientes visible para Admin
- Categoriza pendientes: nuevos clientes, nuevas facturas, modificaciones de pagos
- Operador crea → queda pendiente → Admin aprueba o rechaza

### Vista de Pagos
- Tabla plana de todos los pagos
- Busqueda por cliente, factura, fecha, monto, cuenta, creador
- Filtros por cliente y por estatus
- Ordenamiento por fecha

## Modelo de Datos (Firebase Firestore)

```
registros/                    # Coleccion de facturas
├── {id}
│   ├── id: string            # Ej: "R001"
│   ├── cliente: string
│   ├── factura: string       # Numero de factura
│   ├── fecha_factura: string
│   ├── monto_pagar: number
│   ├── obs: string           # Notas
│   ├── estado: string        # "aprobado" | "pendiente"
│   ├── creado_por: string    # "admin" | "operador"
│   └── pagos: [              # Array de pagos embebidos
│       {
│         id, fecha, monto, cuenta,
│         esquema, obs, estado, creado_por
│       }
│   ]

usuarios/                     # Coleccion de usuarios
├── admin
│   ├── user, password, rol
├── operador
│   ├── user, password, rol
```

## UI/UX

- Tema oscuro con acentos en azul (#4f9cf9), verde (#34d399), purpura (#a78bfa)
- Navegacion por tabs: Dashboard, Clientes, Pagos
- Sistema de modales para todas las operaciones CRUD
- Notificaciones toast (exito/error)
- Indicador de sincronizacion en tiempo real
- Chip de fecha/hora actualizado cada 30 segundos
- Colores unicos por cliente para identificacion visual
- Barras de progreso animadas
- Diseno responsivo
- Fuentes: DM Serif Display, DM Mono, Outfit

## Notas Tecnicas

- Los pagos son sub-documentos dentro de cada factura (no coleccion separada)
- Firebase `onSnapshot()` mantiene datos sincronizados en tiempo real
- `renderAll()` se ejecuta en cada cambio de datos
- Limpieza de datos: convierte nombres de cliente especificos, elimina prefijo "FAC-"
- Toda la app esta en espanol
- Datos seed incluidos para demostracion (7 facturas de ejemplo)

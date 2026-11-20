"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Edit3, Plus, Search, Shield, UserRound, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  Button,
  CopyButton,
  DataTable,
  Dialog,
  DonutChart,
  EmptyState,
  Feedback,
  FormField,
  HorizontalBarChart,
  InsightCard,
  LoadingRows,
  ModalKpiGrid,
  ModalPortal,
  PageTitle,
  PaginationControls,
  SelectInput,
  StatusTag,
  TextInput,
  useEscapeKey,
  useModalFocus,
} from "@/components/workspace/ui";
import { CREATE_USER, UPDATE_USER, USERS_QUERY } from "@/lib/operations";
import { roleLabel } from "@/lib/localization";
import { errorMessage, queryGraphQL, type UserItem } from "@/lib/workspace";
import { matchesSearch } from "@/lib/utils";

type UsersResult = { users: UserItem[] };
type UserResult = { createUser: UserItem; updateUser: UserItem };

const PROTECTED_ROOT_ADMIN_EMAIL = "admin@globalnet.com";
const emptyForm = { fullName: "", email: "", password: "", confirmPassword: "", role: "TECHNICIAN" as UserItem["role"], status: true };
const MAX_USERS = 5000;

export function UsersPage() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [roleFilter, setRoleFilter] = useState<UserItem["role"] | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [sortBy, setSortBy] = useState("NAME_ASC");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [refresh, setRefresh] = useState(0);
  const [confirmDeactivation, setConfirmDeactivation] = useState(false);
  const [confirmChanges, setConfirmChanges] = useState(false);
  const userDialogRef = useModalFocus(formOpen);
  const deactivationDialogRef = useModalFocus(confirmDeactivation);
  const changesDialogRef = useModalFocus(confirmChanges);

  useEscapeKey(confirmDeactivation || confirmChanges || formOpen, () => {
    if (confirmDeactivation) setConfirmDeactivation(false);
    else if (confirmChanges) setConfirmChanges(false);
    else setFormOpen(false);
  });

  useEffect(() => {
    let active = true;
    queryGraphQL<UsersResult>(USERS_QUERY, { limit: MAX_USERS })
      .then((result) => { if (active) setUsers(result.users); })
      .catch((error: unknown) => { if (active) setFeedback({ error: errorMessage(error) }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, refresh]);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const matchesText = matchesSearch(`${user.fullName ?? ""} ${user.email} ${user.role}`, search);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? user.status : !user.status);
      return matchesText && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "NAME_ASC":
          return (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email);
        case "NAME_DESC":
          return (b.fullName ?? b.email).localeCompare(a.fullName ?? a.email);
        case "EMAIL_ASC":
          return a.email.localeCompare(b.email);
        case "ROLE":
          return a.role.localeCompare(b.role);
        case "STATUS_ACTIVE":
          return Number(b.status) - Number(a.status);
        case "STATUS_INACTIVE":
          return Number(a.status) - Number(b.status);
        default:
          return 0;
      }
    });
  }, [filtered, sortBy]);

  const visibleUsers = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const activeUsers = users.filter((user) => user.status).length;
  const technicians = users.filter((user) => user.role === "TECHNICIAN").length;
  const [userModalKey, setUserModalKey] = useState<"ALL" | "ACTIVE" | "TECHNICIANS" | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalRoleFilter, setModalRoleFilter] = useState<"ALL" | "ADMIN" | "INSPECTOR" | "TECHNICIAN">("ALL");
  const [modalStatusFilter, setModalStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const adminsCount = useMemo(() => users.filter((u) => u.role === "ADMIN").length, [users]);
  const inspectorsCount = useMemo(() => users.filter((u) => u.role === "INSPECTOR").length, [users]);
  const techniciansCount = useMemo(() => users.filter((u) => u.role === "TECHNICIAN").length, [users]);
  const activeRate = users.length > 0 ? ((activeUsers / users.length) * 100).toFixed(0) : "0";
  const inactiveUsers = users.length - activeUsers;

  function openUserModal(key: "ALL" | "ACTIVE" | "TECHNICIANS") {
    setUserModalKey(key);
    setModalSearch("");
    if (key === "ACTIVE") {
      setModalRoleFilter("ALL");
      setModalStatusFilter("ACTIVE");
    } else if (key === "TECHNICIANS") {
      setModalRoleFilter("TECHNICIAN");
      setModalStatusFilter("ALL");
    } else {
      setModalRoleFilter("ALL");
      setModalStatusFilter("ALL");
    }
  }

  const modalFilteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (modalRoleFilter !== "ALL" && u.role !== modalRoleFilter) return false;
      if (modalStatusFilter !== "ALL" && (modalStatusFilter === "ACTIVE" ? !u.status : u.status)) return false;
      const term = modalSearch.trim();
      if (!term) return true;
      const haystack = `${u.fullName ?? ""} ${u.email} ${u.role} ${u.id}`;
      return matchesSearch(haystack, term);
    });
  }, [users, modalRoleFilter, modalStatusFilter, modalSearch]);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    setFeedback({});
  }

  function startEdit(user: UserItem) {
    if (user.email.trim().toLowerCase() === PROTECTED_ROOT_ADMIN_EMAIL) {
      setFeedback({ error: "La cuenta raíz de seguridad (admin@globalnet.com) está protegida y no puede ser editada ni desactivada." });
      return;
    }
    setEditing(user);
    setForm({ fullName: user.fullName ?? "", email: user.email, password: "", confirmPassword: "", role: user.role, status: user.status });
    setFormOpen(true);
    setFeedback({});
  }

  async function persistUser() {
    setSaving(true);
    setFeedback({});
    try {
      if (editing) {
        if (editing.email.trim().toLowerCase() === PROTECTED_ROOT_ADMIN_EMAIL) {
          setFeedback({ error: "La cuenta raíz de seguridad (admin@globalnet.com) está protegida y no puede ser editada ni desactivada." });
          return;
        }
        const input = {
          id: editing.id,
          fullName: form.fullName,
          email: form.email,
          password: form.password || null,
          role: form.role,
          status: form.status,
        };
        await queryGraphQL<UserResult>(UPDATE_USER, { input });
        setFeedback({ success: "La cuenta se actualizó." });
      } else {
        const input = {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          status: form.status,
        };
        await queryGraphQL<UserResult>(CREATE_USER, { input });
        setFeedback({ success: "La cuenta se creó." });
      }
      setFormOpen(false);
      setRefresh((value) => value + 1);
    } catch (error) {
      setFeedback({ error: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing && editing.email.trim().toLowerCase() === PROTECTED_ROOT_ADMIN_EMAIL) {
      setFeedback({ error: "La cuenta raíz de seguridad (admin@globalnet.com) está protegida y no puede ser editada ni desactivada." });
      return;
    }
    if ((!editing || form.password) && form.password !== form.confirmPassword) {
      setFeedback({ error: "La contraseña y su confirmación deben coincidir." });
      return;
    }
    if (!editing) {
      void persistUser();
      return;
    }
    if (editing?.status && !form.status) {
      setConfirmDeactivation(true);
      return;
    }
    setConfirmChanges(true);
  }

  return (
    <div className="work-page">
      <PageTitle eyebrow="ADMINISTRACIÓN · CUENTAS" title="Usuarios" description="Administra identidades, permisos y estado de acceso." action={<Button onClick={startCreate}><Plus size={16} /> Crear usuario</Button>} />
      <Feedback {...feedback} />
      <section className="insight-grid" aria-label="Indicadores de usuarios">
        <InsightCard
          label="USUARIOS CARGADOS"
          value={users.length}
          description="Cuentas incluidas en la consulta actual."
          progress={Math.min(users.length * 2, 100)}
          detail={`${users.length} cuentas están incluidas en la consulta actual; ajusta el selector de ítems para ampliar la muestra.`}
          onClick={() => openUserModal("ALL")}
        />
        <InsightCard
          label="CUENTAS ACTIVAS"
          value={activeUsers}
          description="Usuarios con acceso habilitado."
          progress={users.length ? (activeUsers / users.length) * 100 : 0}
          detail={`${activeUsers} de ${users.length} cuentas tienen acceso habilitado.`}
          onClick={() => openUserModal("ACTIVE")}
        />
        <InsightCard
          label="TÉCNICOS"
          value={technicians}
          description="Cuentas asignadas a operación técnica."
          progress={users.length ? (technicians / users.length) * 100 : 0}
          detail={`${technicians} cuentas tienen el rol de técnico.`}
          onClick={() => openUserModal("TECHNICIANS")}
        />
      </section>
      <section className="work-section">
        <div className="section-toolbar">
          <div className="toolbar-title"><UserRound size={17} /><strong>Directorio de usuarios</strong><span>{sorted.length}</span></div>
          <div className="toolbar-controls">
            <label className="search-control">
              <Search size={16} />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Buscar por nombre, correo o rol" aria-label="Buscar usuarios" />
            </label>
            <SelectInput className="filter-select" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as typeof roleFilter); setPage(0); }} aria-label="Filtrar usuarios por rol">
              <option value="ALL">Todos los roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="INSPECTOR">INSPECTOR</option>
              <option value="TECHNICIAN">TECHNICIAN</option>
            </SelectInput>
            <SelectInput className="filter-select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(0); }} aria-label="Filtrar usuarios por estado">
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
            </SelectInput>
            <SelectInput className="filter-select" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(0); }} aria-label="Ordenar usuarios por">
              <option value="NAME_ASC">Nombre (A-Z)</option>
              <option value="NAME_DESC">Nombre (Z-A)</option>
              <option value="EMAIL_ASC">Correo (A-Z)</option>
              <option value="ROLE">Rol</option>
              <option value="STATUS_ACTIVE">Activos primero</option>
              <option value="STATUS_INACTIVE">Inactivos primero</option>
            </SelectInput>
          </div>
        </div>
        {loading ? <LoadingRows label="Cargando usuarios" /> : sorted.length === 0 ? <EmptyState title={users.length === 0 ? "No hay usuarios registrados" : "Sin coincidencias"} detail={users.length === 0 ? "No hay usuarios registrados en el sistema en este momento." : "No encontramos usuarios que coincidan con la búsqueda."} /> : (
          <DataTable headings={["Usuario", "Correo", "Rol", "Estado", "Acciones"]}>
            {visibleUsers.map((user) => {
              const isProtectedRoot = user.email.trim().toLowerCase() === PROTECTED_ROOT_ADMIN_EMAIL;
              return (
                <tr key={user.id}>
                  <td>
                    <span className="table-primary">{user.fullName || "Sin nombre"}</span>
                    <small className="table-secondary copy-value font-mono">
                      ID <span className="telemetry-value">{user.id}</span>
                      <CopyButton className="inline-copy" text={user.id} label={`Copiar ID de ${user.fullName || user.email}`} />
                    </small>
                  </td>
                  <td>{user.email}</td>
                  <td><span className="role-label">{roleLabel(user.role)}</span></td>
                  <td><StatusTag value={user.status ? "ACTIVE" : "INACTIVE"} /></td>
                  <td>
                    {isProtectedRoot ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 cursor-default select-none"
                        title="Cuenta de emergencia del sistema: no editable ni desactivable"
                      >
                        <Shield size={12} className="text-amber-600 dark:text-amber-400" />
                        <span>Cuenta protegida</span>
                      </span>
                    ) : (
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => startEdit(user)}
                        aria-label={`Editar usuario ${user.email}`}
                        title={`Editar usuario ${user.email}`}
                      >
                        <Edit3 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
        <PaginationControls currentPage={page} totalItems={sorted.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(0); }} itemLabel="usuarios" />
      </section>

      {formOpen && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
            <section ref={userDialogRef} tabIndex={-1} className="work-modal user-form-modal" role="dialog" aria-modal="true" aria-labelledby="user-form-title">
              <div className="modal-heading">
                <div><p className="work-eyebrow">ADMINISTRACIÓN</p><h2 id="user-form-title">{editing ? "Editar usuario" : "Nueva cuenta"}</h2></div>
                <button className="table-action" type="button" onClick={() => setFormOpen(false)} aria-label="Cerrar formulario"><X size={18} /></button>
              </div>

              <form className="work-form user-form" onSubmit={saveUser}>
                <FormField label="Nombre completo">
                  <TextInput value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required autoComplete="name" />
                </FormField>
                <FormField label="Correo electrónico">
                  <TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" />
                </FormField>
                <FormField label={editing ? "Nueva contraseña (opcional)" : "Contraseña inicial"}>
                  <TextInput type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} autoComplete="new-password" />
                </FormField>
                <FormField label="Confirmar contraseña">
                  <TextInput
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                    required={!editing || Boolean(form.password)}
                    autoComplete="new-password"
                  />
                </FormField>
                <div className="form-grid two-col">
                  <FormField label="Rol">
                    <SelectInput value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserItem["role"] })} disabled={Boolean(editing)}>
                      <option value="ADMIN">Director de Logística</option>
                      <option value="INSPECTOR">Encargado de Bodega</option>
                      <option value="TECHNICIAN">Técnico de Campo</option>
                    </SelectInput>
                    {editing && <small className="form-hint">El rol no es modificable</small>}
                  </FormField>
                  <FormField label="Estado">
                    <SelectInput value={form.status ? "active" : "inactive"} onChange={(event) => setForm({ ...form, status: event.target.value === "active" })}>
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </SelectInput>
                  </FormField>
                </div>
                <Feedback error={feedback.error} />
                <div className="modal-actions">
                  <Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button>
                  <Button type="submit" loading={saving}>{editing ? "Guardar cambios" : "Crear cuenta"}</Button>
                </div>
              </form>
            </section>
          </div>
        </ModalPortal>
      )}
      {confirmDeactivation && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation"><section ref={deactivationDialogRef} tabIndex={-1} className="work-modal" role="alertdialog" aria-modal="true" aria-labelledby="deactivation-title" aria-describedby="deactivation-description">
            <div className="modal-heading"><div><p className="work-eyebrow">ADMINISTRACIÓN · CUENTAS</p><h2 id="deactivation-title">Confirmar desactivación</h2></div></div>
            <p id="deactivation-description" className="legal-notice-copy">La cuenta de {editing?.email} dejará de tener acceso a AssetGuard. ¿Deseas continuar?</p>
            <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setConfirmDeactivation(false)}>Cancelar</Button><Button variant="danger" type="button" loading={saving} onClick={() => { setConfirmDeactivation(false); void persistUser(); }}>Confirmar desactivación</Button></div>
          </section></div>
        </ModalPortal>
      )}
      {confirmChanges && (
        <ModalPortal>
          <div className="modal-backdrop confirmation-backdrop" role="presentation"><section ref={changesDialogRef} tabIndex={-1} className="work-modal" role="alertdialog" aria-modal="true" aria-labelledby="user-confirm-title" aria-describedby="user-confirm-description">
            <div className="modal-heading"><div><p className="work-eyebrow">ADMINISTRACIÓN · CUENTAS</p><h2 id="user-confirm-title">Confirmar cambios</h2></div></div>
            <p id="user-confirm-description" className="legal-notice-copy">¿Deseas guardar los cambios realizados en la cuenta de {editing?.email}?</p>
            <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setConfirmChanges(false)}>Volver a editar</Button><Button type="button" loading={saving} onClick={() => { setConfirmChanges(false); void persistUser(); }}>Guardar cambios</Button></div>
          </section></div>
        </ModalPortal>
      )}

      {userModalKey && (
        <Dialog
          open
          title={
            userModalKey === "ALL"
              ? "Usuarios: Desglose global de cuentas"
              : userModalKey === "ACTIVE"
              ? "Usuarios: Cuentas con acceso habilitado"
              : "Usuarios: Cuentas de técnicos de campo"
          }
          eyebrow={
            userModalKey === "ALL"
              ? "ADMINISTRACIÓN · CATÁLOGO"
              : userModalKey === "ACTIVE"
              ? "ADMINISTRACIÓN · ACCESOS ACTIVOS"
              : "ADMINISTRACIÓN · TÉCNICOS"
          }
          onClose={() => setUserModalKey(null)}
        >
          <div className="space-y-4">
            <ModalKpiGrid
              items={[
                {
                  label: "Total cuentas",
                  value: `${users.length}`,
                  sub: `${activeUsers} activas (${activeRate}%)`,
                },
                {
                  label: "Director Logística",
                  value: `${adminsCount}`,
                  sub: `${((adminsCount / Math.max(1, users.length)) * 100).toFixed(0)}% del total (ADMIN)`,
                },
                {
                  label: "Encargado Bodega",
                  value: `${inspectorsCount}`,
                  sub: `${((inspectorsCount / Math.max(1, users.length)) * 100).toFixed(0)}% del total (INSPECTOR)`,
                },
                {
                  label: "Técnico Campo",
                  value: `${techniciansCount}`,
                  sub: `${((techniciansCount / Math.max(1, users.length)) * 100).toFixed(0)}% del total (TECHNICIAN)`,
                },
              ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="modal-chart-card mb-0">
                <div className="modal-chart-title">
                  <span>Composición por rol</span>
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    {users.length} cuentas
                  </span>
                </div>
                <DonutChart
                  segments={[
                    {
                      label: "Director de Logística",
                      value: adminsCount,
                      color: "#6366f1",
                      formattedValue: `${adminsCount} cuentas`,
                    },
                    {
                      label: "Encargado de Bodega",
                      value: inspectorsCount,
                      color: "#0ea5e9",
                      formattedValue: `${inspectorsCount} cuentas`,
                    },
                    {
                      label: "Técnico de Campo",
                      value: techniciansCount,
                      color: "#10b981",
                      formattedValue: `${techniciansCount} cuentas`,
                    },
                  ]}
                  centerValue={`${users.length}`}
                  centerLabel="TOTAL"
                />
              </div>

              <div className="modal-chart-card mb-0">
                <div className="modal-chart-title">
                  <span>Estado de acceso</span>
                  <span className="font-mono text-xs text-slate-500">
                    {activeRate}% activas
                  </span>
                </div>
                <HorizontalBarChart
                  items={[
                    {
                      label: "Cuentas activas",
                      value: activeUsers,
                      color: "#10b981",
                      formattedValue: `${activeUsers} cuentas`,
                      percentage: users.length > 0 ? (activeUsers / users.length) * 100 : 0,
                    },
                    {
                      label: "Cuentas inactivas",
                      value: inactiveUsers,
                      color: "#ef4444",
                      formattedValue: `${inactiveUsers} cuentas`,
                      percentage: users.length > 0 ? (inactiveUsers / users.length) * 100 : 0,
                    },
                  ]}
                />
              </div>
            </div>

            <div>
              <div className="modal-table-controls">
                <label className="search-control">
                  <Search size={14} />
                  <input
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Buscar por nombre, correo o rol..."
                    aria-label="Buscar en catálogo de usuarios"
                  />
                </label>
                <SelectInput
                  className="filter-select w-44 text-xs"
                  value={modalRoleFilter}
                  onChange={(e) => setModalRoleFilter(e.target.value as typeof modalRoleFilter)}
                  aria-label="Filtrar por rol de usuario"
                >
                  <option value="ALL">Todos los roles</option>
                  <option value="ADMIN">Director de Logística</option>
                  <option value="INSPECTOR">Encargado de Bodega</option>
                  <option value="TECHNICIAN">Técnico de Campo</option>
                </SelectInput>
                <SelectInput
                  className="filter-select w-36 text-xs"
                  value={modalStatusFilter}
                  onChange={(e) => setModalStatusFilter(e.target.value as typeof modalStatusFilter)}
                  aria-label="Filtrar por estado de acceso"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="ACTIVE">Solo activos</option>
                  <option value="INACTIVE">Solo inactivos</option>
                </SelectInput>
                <span className="text-[11px] font-mono text-slate-500">
                  {modalFilteredUsers.length} de {users.length} cuentas
                </span>
              </div>

              <div className="metric-breakdown-table-wrap">
                <table className="metric-breakdown-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th className="whitespace-nowrap">Rol</th>
                      <th className="whitespace-nowrap">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalFilteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-slate-400 text-xs">
                          No se encontraron usuarios que coincidan con los filtros.
                        </td>
                      </tr>
                    ) : (
                      modalFilteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {user.fullName || "Sin nombre"}
                              </span>
                              <small className="text-slate-400 font-mono text-[10px]">
                                ID #{user.id}
                              </small>
                              <CopyButton
                                text={user.id}
                                label={`Copiar ID de ${user.fullName || user.email}`}
                              />
                            </div>
                          </td>
                          <td className="font-mono text-slate-600 dark:text-slate-300">
                            <span className="flex items-center gap-1">
                              {user.email}
                              <CopyButton
                                text={user.email}
                                label={`Copiar correo ${user.email}`}
                              />
                            </span>
                          </td>
                          <td className="whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                user.role === "ADMIN"
                                  ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300"
                                  : user.role === "INSPECTOR"
                                  ? "bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300"
                                  : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                              }`}
                            >
                              {roleLabel(user.role)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap">
                            {user.status ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                                Inactivo
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
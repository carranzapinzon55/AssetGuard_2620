"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Edit3, Plus, Search, UserRound, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput, useEscapeKey, useModalFocus } from "@/components/workspace/ui";
import { CREATE_USER, UPDATE_USER, USERS_QUERY } from "@/lib/operations";
import { roleLabel } from "@/lib/localization";
import { errorMessage, queryGraphQL, type UserItem } from "@/lib/workspace";

type UsersResult = { users: UserItem[] };
type UserResult = { createUser: UserItem; updateUser: UserItem };

const emptyForm = { fullName: "", email: "", password: "", role: "TECHNICIAN" as UserItem["role"], status: true };

export function UsersPage() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [roleFilter, setRoleFilter] = useState<UserItem["role"] | "ALL">("ALL");
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
    queryGraphQL<UsersResult>(USERS_QUERY)
      .then((result) => { if (active) setUsers(result.users); })
      .catch((error: unknown) => { if (active) setFeedback({ error: errorMessage(error) }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, refresh]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = `${user.fullName ?? ""} ${user.email} ${user.role}`.toLowerCase().includes(query);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    setFeedback({});
  }

  function startEdit(user: UserItem) {
    setEditing(user);
    setForm({ fullName: user.fullName ?? "", email: user.email, password: "", role: user.role, status: user.status });
    setFormOpen(true);
    setFeedback({});
  }

  async function persistUser() {
    setSaving(true);
    setFeedback({});
    try {
      if (editing) {
        const input = { id: editing.id, ...form, password: form.password || null };
        await queryGraphQL<UserResult>(UPDATE_USER, { input });
        setFeedback({ success: "La cuenta se actualizó." });
      } else {
        if (!form.password) throw new Error("La contraseña es obligatoria para una cuenta nueva.");
        await queryGraphQL<UserResult>(CREATE_USER, { input: form });
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
      <section className="work-section">
        <div className="section-toolbar">
          <div className="toolbar-title"><UserRound size={17} /><strong>Directorio de usuarios</strong><span>{users.length}</span></div>
          <div className="toolbar-controls"><label className="search-control"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, correo o rol" aria-label="Buscar usuarios" /></label><SelectInput className="filter-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)} aria-label="Filtrar usuarios por rol"><option value="ALL">Todos los roles</option><option value="ADMIN">ADMIN</option><option value="INSPECTOR">INSPECTOR</option><option value="TECHNICIAN">TECHNICIAN</option></SelectInput></div>
        </div>
        {loading ? <LoadingRows label="Cargando usuarios" /> : filtered.length === 0 ? <EmptyState title={users.length === 0 ? "No hay usuarios registrados" : "Sin coincidencias"} detail={users.length === 0 ? "No hay usuarios registrados en el sistema en este momento." : "No encontramos usuarios que coincidan con la búsqueda."} /> : (
          <DataTable headings={["Usuario", "Correo", "Rol", "Estado", "Acciones"]}>
            {filtered.map((user) => <tr key={user.id}>
              <td><span className="table-primary">{user.fullName || "Sin nombre"}</span><small className="table-secondary">ID {user.id}</small></td>
              <td>{user.email}</td><td><span className="role-label">{roleLabel(user.role)}</span></td><td><StatusTag value={user.status ? "ACTIVE" : "INACTIVE"} /></td>
              <td><button className="table-action" type="button" onClick={() => startEdit(user)} aria-label={`Editar usuario ${user.email}`} title={`Editar usuario ${user.email}`}><Edit3 size={15} /></button></td>
            </tr>)}
          </DataTable>
        )}
      </section>

      {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
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
      </div>}
      {confirmDeactivation && <div className="modal-backdrop" role="presentation"><section ref={deactivationDialogRef} tabIndex={-1} className="work-modal" role="alertdialog" aria-modal="true" aria-labelledby="deactivation-title" aria-describedby="deactivation-description">
        <div className="modal-heading"><div><p className="work-eyebrow">ADMINISTRACIÓN · CUENTAS</p><h2 id="deactivation-title">Confirmar desactivación</h2></div></div>
        <p id="deactivation-description" className="legal-notice-copy">La cuenta de {editing?.email} dejará de tener acceso a AssetGuard. ¿Deseas continuar?</p>
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setConfirmDeactivation(false)}>Cancelar</Button><Button variant="danger" type="button" loading={saving} onClick={() => { setConfirmDeactivation(false); void persistUser(); }}>Confirmar desactivación</Button></div>
      </section></div>}
      {confirmChanges && <div className="modal-backdrop confirmation-backdrop" role="presentation"><section ref={changesDialogRef} tabIndex={-1} className="work-modal" role="alertdialog" aria-modal="true" aria-labelledby="user-confirm-title" aria-describedby="user-confirm-description">
        <div className="modal-heading"><div><p className="work-eyebrow">ADMINISTRACIÓN · CUENTAS</p><h2 id="user-confirm-title">Confirmar cambios</h2></div></div>
        <p id="user-confirm-description" className="legal-notice-copy">¿Deseas guardar los cambios realizados en la cuenta de {editing?.email}?</p>
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setConfirmChanges(false)}>Volver a editar</Button><Button type="button" loading={saving} onClick={() => { setConfirmChanges(false); void persistUser(); }}>Guardar cambios</Button></div>
      </section></div>}
    </div>
  );
}
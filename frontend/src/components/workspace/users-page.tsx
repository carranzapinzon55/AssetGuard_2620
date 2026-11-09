"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Edit3, Plus, Search, UserRound, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput } from "@/components/workspace/ui";
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
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [refresh, setRefresh] = useState(0);

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
    if (!query) return users;
    return users.filter((user) => `${user.fullName ?? ""} ${user.email} ${user.role}`.toLowerCase().includes(query));
  }, [users, search]);

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

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  return (
    <div className="work-page">
      <PageTitle eyebrow="ADMINISTRACIÓN · CUENTAS" title="Usuarios" description="Administra identidades, permisos y estado de acceso." action={<Button onClick={startCreate}><Plus size={16} /> Crear usuario</Button>} />
      <Feedback {...feedback} />
      <section className="work-section">
        <div className="section-toolbar">
          <div className="toolbar-title"><UserRound size={17} /><strong>Directorio de usuarios</strong><span>{users.length}</span></div>
          <label className="search-control"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, correo o rol" aria-label="Buscar usuarios" /></label>
        </div>
        {loading ? <LoadingRows label="Cargando usuarios" /> : filtered.length === 0 ? <EmptyState title={users.length === 0 ? "No hay usuarios registrados" : "Sin coincidencias"} detail={users.length === 0 ? "No hay usuarios registrados en el sistema en este momento." : "No encontramos usuarios que coincidan con la búsqueda."} /> : (
          <DataTable headings={["Usuario", "Correo", "Rol", "Estado", "Acciones"]}>
            {filtered.map((user) => <tr key={user.id}>
              <td><span className="table-primary">{user.fullName || "Sin nombre"}</span><small className="table-secondary">ID {user.id}</small></td>
              <td>{user.email}</td><td><span className="role-label">{roleLabel(user.role)}</span></td><td><StatusTag value={user.status ? "ACTIVE" : "INACTIVE"} /></td>
              <td><button className="table-action" type="button" onClick={() => startEdit(user)} aria-label={`Editar ${user.email}`} title="Editar usuario"><Edit3 size={15} /></button></td>
            </tr>)}
          </DataTable>
        )}
      </section>

      {formOpen && <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
        {/* Contenedor del modal con dimensiones propias, independiente de la tabla */}
        <section 
          className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden" 
          style={{ width: '520px', maxWidth: '95vw', maxHeight: '85vh' }}
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="user-form-title"
        >
          {/* Encabezado original restaurado y fijo */}
          <div className="modal-heading flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <p className="work-eyebrow text-xs font-semibold text-gray-500">ADMINISTRACIÓN</p>
              <h2 id="user-form-title" className="text-lg font-bold text-gray-900">{editing ? "Editar usuario" : "Nueva cuenta"}</h2>
            </div>
            <button className="table-action p-1 rounded-lg hover:bg-gray-100" type="button" onClick={() => setFormOpen(false)} aria-label="Cerrar formulario">
              <X size={18} />
            </button>
          </div>

          {/* Formulario con scroll interno para que los botones de acción nunca se oculten */}
          <form className="work-form flex-1 overflow-y-auto p-6 space-y-4" onSubmit={saveUser}>
            <FormField label="Nombre completo">
              <TextInput value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required autoComplete="name" />
            </FormField>
            <FormField label="Correo electrónico">
              <TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" />
            </FormField>
            <FormField label={editing ? "Nueva contraseña (opcional)" : "Contraseña inicial"}>
              <TextInput type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} autoComplete="new-password" />
            </FormField>
            <div className="form-grid two-col grid grid-cols-2 gap-3">
              <FormField label="Rol">
                <SelectInput value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserItem["role"] })}>
                  <option value="ADMIN">Director de Logística</option>
                  <option value="INSPECTOR">Encargado de Bodega</option>
                  <option value="TECHNICIAN">Técnico de Campo</option>
                </SelectInput>
              </FormField>
              <FormField label="Estado">
                <SelectInput value={form.status ? "active" : "inactive"} onChange={(event) => setForm({ ...form, status: event.target.value === "active" })}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </SelectInput>
              </FormField>
            </div>
            <Feedback error={feedback.error} />
            <div className="modal-actions pt-4 mt-2 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
              <Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>{editing ? "Guardar cambios" : "Crear cuenta"}</Button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  );
}
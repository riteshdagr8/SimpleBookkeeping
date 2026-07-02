import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/services/users";
import { format } from "date-fns";
import { UsersClient } from "./users-client";

export default async function AdminUsersPage() {
  const actor = await requireAdmin();
  const users = await listUsers(actor.tenantId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Users</h1>
        <p className="text-sm text-fg-muted">
          Add or remove staff. Only Admins can create users, deactivate accounts, or reset passwords.
        </p>
      </div>
      <UsersClient
        currentUserId={actor.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          theme: u.theme,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

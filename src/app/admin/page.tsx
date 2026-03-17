import { isAdmin } from "./actions";
import { LoginForm } from "./LoginForm";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAdmin();

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoginForm />
      </div>
    );
  }

  return <AdminDashboard />;
}

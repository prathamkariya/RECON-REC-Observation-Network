import { ProtectedRoute } from "@/components/protected-route";
import { AppNav } from "@/components/nav/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </ProtectedRoute>
  );
}

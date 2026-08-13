import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
      <p className="text-gray-300">Welcome, {session?.user?.email}</p>
    </div>
  );
}
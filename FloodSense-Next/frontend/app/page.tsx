import Dashboard from "../components/Dashboard";
import Link from "next/link";
export default function Home() {
  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-3 text-sm">
        <span>Scenario planner · simulated conditions</span>
        <Link className="text-blue-700 underline" href="/streets">
          Open backend street monitor →
        </Link>
      </div>
      <Dashboard />
    </>
  );
}

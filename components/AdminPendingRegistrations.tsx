import React, { useCallback, useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import {
  approveRegistration,
  fetchPendingRegistrations,
} from "../services/authService";

interface AdminPendingRegistrationsProps {
  isDark: boolean;
}

export const AdminPendingRegistrations: React.FC<AdminPendingRegistrationsProps> = ({
  isDark,
}) => {
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const list = await fetchPendingRegistrations();
    if (list === null) setError("Impossible de charger la liste.");
    else setEmails(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (email: string) => {
    setBusy(email);
    setError("");
    const ok = await approveRegistration(email);
    setBusy(null);
    if (ok) {
      setEmails((prev) => prev.filter((e) => e !== email));
    } else {
      setError("Validation impossible. Réessayez.");
    }
  };

  const cardClass = `rounded-2xl border p-5 ${
    isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"
  }`;

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2 mb-4">
        <UserCheck className={`w-5 h-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
        <h3 className={`text-sm font-bold uppercase tracking-widest ${isDark ? "text-slate-200" : "text-slate-700"}`}>
          Inscriptions à valider
        </h3>
      </div>
      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>
      )}
      {loading ? (
        <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Chargement…</p>
      ) : emails.length === 0 ? (
        <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Aucune demande en attente.
        </p>
      ) : (
        <ul className="space-y-2">
          {emails.map((em) => (
            <li
              key={em}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                isDark ? "bg-slate-800/80" : "bg-slate-50"
              }`}
            >
              <span className="font-mono text-xs break-all">{em}</span>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleApprove(em)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {busy === em ? "…" : "Valider"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

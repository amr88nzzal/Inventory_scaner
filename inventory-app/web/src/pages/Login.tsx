import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err: any) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink" dir="rtl">
      <form onSubmit={handleSubmit} className="bg-paper rounded-sm w-full max-w-sm p-8">
        <div className="font-display text-2xl font-semibold mb-1">نظام الجرد</div>
        <div className="text-sm text-graphite/70 mb-8">تسجيل دخول الأدمن</div>

        <label className="block text-sm mb-1 text-graphite">اسم المستخدم</label>
        <input
          className="w-full border border-graphite/20 rounded-sm px-3 py-2 mb-4 bg-white focus:border-signal outline-none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <label className="block text-sm mb-1 text-graphite">كلمة المرور</label>
        <input
          type="password"
          className="w-full border border-graphite/20 rounded-sm px-3 py-2 mb-6 bg-white focus:border-signal outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="text-warn text-sm mb-4">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ink text-paper py-2.5 rounded-sm hover:bg-signal transition-colors font-medium"
        >
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}

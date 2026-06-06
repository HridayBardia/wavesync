"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Users, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async function handleJoin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your display name");
      return;
    }
    if (!code.trim()) {
      setError("Please enter a room code to join");
      return;
    }
    setLoading(true);
    setError("");
    sessionStorage.setItem("ws_display_name", name.trim());
    router.push(`/room/${code.trim().toUpperCase()}`);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Please enter your display name first");
      return;
    }
    setLoading(true);
    setError("");
    const newCode = generateCode();
    sessionStorage.setItem("ws_display_name", name.trim());
    router.push(`/room/${newCode}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#030014]">
      {/* Background Ambient Glow */}
      <div className="ambient-glow"></div>

      {/* Navbar */}
      <nav className="absolute top-0 w-full flex justify-between items-center p-6 lg:px-12 z-10">
        <div className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
            <Play size={16} className="text-white fill-current ml-0.5" />
          </div>
          WaveSync
        </div>
      </nav>

      {/* Hero Content */}
      <div className="z-10 flex flex-col items-center justify-center w-full max-w-4xl px-4 text-center mt-12 animate-float">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4">
          Listen Together, <br />
          <span className="text-gradient">Perfectly Synced.</span>
        </h1>
        <p className="text-base md:text-lg text-slate-400 mb-8 max-w-2xl">
          Experience sub-millisecond audio synchronization across any device.
          Create a room, invite friends, and feel the music as one.
        </p>

        {/* Action Panel */}
        <div className="glass-panel p-8 w-full max-w-md flex flex-col gap-5 border-brand/10">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Your Display Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-center text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
              maxLength={20}
            />
          </div>

          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-transparent px-3 text-xs text-slate-600 uppercase tracking-widest absolute bg-[#030014]/85 backdrop-blur-sm">
              Room Options
            </span>
          </div>

          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Enter Room Code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError("");
              }}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-center text-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all uppercase tracking-widest font-mono"
              maxLength={8}
            />

            {error && (
              <p className="text-rose-500 text-xs font-medium text-center animate-pulse">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full secondary-button rounded-xl py-3 font-semibold text-white hover:text-brand-light flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Users size={18} />
              {loading ? "Connecting..." : "Join Existing Room"}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-transparent px-3 text-xs text-slate-600 uppercase tracking-widest absolute bg-[#030014]/85 backdrop-blur-sm">
              Or
            </span>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full glow-button rounded-xl py-3 font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <Sparkles size={18} />
            {loading ? "Creating..." : "Create New Room"}
          </button>
        </div>
      </div>
    </main>
  );
}


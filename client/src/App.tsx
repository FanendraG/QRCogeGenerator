import { useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export default function App() {
  const [text, setText] = useState("Hello from QR ✨");
  const [format, setFormat] = useState<"png" | "svg">("png");
  const [ppm, setPpm] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const canGenerate = useMemo(
    () => text.trim().length > 0 && ppm > 0 && ppm <= 50,
    [text, ppm]
  );

  async function generate() {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    setDataUrl(null);
    try {
      const res = await fetch(`${API_BASE}/api/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, format, pixelsPerModule: ppm }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.error || `Request failed: ${res.status}`);
      }
      const payload = await res.json();
      setDataUrl(payload.dataUrl);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    const ext = format === "svg" ? "svg" : "png";
    link.download = `qr.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="min-h-full px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          QR Code Generator
        </h1>
        <p className="mt-2 text-slate-600">
          React + .NET 8 • PNG/SVG • Download ready
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <label className="block text-sm font-medium text-slate-700">
              Text to encode
            </label>
            <textarea
              className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
              rows={7}
              placeholder="Enter any text, URL, etc."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <div className="mt-4 flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Format
                </label>
                <select
                  className="mt-1 rounded-lg border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as "png" | "svg")}
                >
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Pixels per module
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="mt-1 w-28 rounded-lg border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={ppm}
                  onChange={(e) => setPpm(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={generate}
                disabled={!canGenerate || loading}
                className="rounded-xl bg-sky-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Generating…" : "Generate QR"}
              </button>

              <button
                onClick={download}
                disabled={!dataUrl}
                className="rounded-xl bg-slate-900 px-4 py-2 font-medium text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-center rounded-2xl bg-white p-5 shadow-sm">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt="QR preview"
                className="max-h-[420px] max-w-full rounded-xl border border-slate-200"
              />
            ) : (
              <div className="text-slate-500">
                Your generated QR will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

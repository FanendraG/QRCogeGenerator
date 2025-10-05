# QR Code Generator – React (Vite) + .NET 8 Web API

A bite‑sized full‑stack project you can ship to GitHub today. The React front end lets a user type text and instantly get a QR code; the .NET 8 backend generates PNG or SVG using the popular **QRCoder** library.

---

## What you’ll build

- **Frontend:** React + Vite + TypeScript + Tailwind UI (clean, modern form; preview + download).
- **Backend:** .NET 8 Minimal API with a single endpoint: `POST /api/qr` that returns a Data URL for PNG or SVG.
- **Extras:** CORS configured for local dev, Swagger for testing, curl test, GitHub push steps.

---

## Prerequisites

- **.NET 8 SDK** — check with `dotnet --version` (should start with `8.`)
- **Node.js 20+ and npm** — check with `node -v` and `npm -v`
- A terminal (PowerShell, bash, etc.) and **Git** (`git --version`)

> If you need installers: [dotnet.microsoft.com](https://dotnet.microsoft.com/) and [nodejs.org](https://nodejs.org/). (Not required to click now—only for first‑time setup.)

---

## Project structure

We’ll keep it simple:

```
qrcode-fullstack/
├─ server/         # .NET 8 Minimal API
└─ client/         # React + Vite + TS + Tailwind
```

---

## 1) Create the solution folder

```bash
mkdir qrcode-fullstack
cd qrcode-fullstack
```

---

## 2) Backend – .NET 8 Minimal API

### 2.1 Create a Web API project

```bash
mkdir server
cd server
 dotnet new webapi -n QrApi
cd QrApi
```

This creates a Web API skeleton with Swagger.

### 2.2 Add the QR library

```bash
dotnet add package QRCoder
```

### 2.3 Enable CORS (so React can call the API)

Open **Program.cs** and replace its content with the following:

```csharp
using Microsoft.AspNetCore.Mvc;
using QRCoder;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Allow local Vite dev server
const string DevClient = "http://localhost:5173"; // Vite default
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(DevClient)
     .AllowAnyHeader()
     .AllowAnyMethod()
));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Request DTO
public record GenerateQrRequest(
    string text,
    string? format = "png", // "png" | "svg"
    int? pixelsPerModule = 10 // size scalar for both png & svg
);

// Response DTO
public record GenerateQrResponse(
    string dataUrl,
    string contentType,
    int pixelsPerModule,
    string format
);

app.MapPost("/api/qr", ([FromBody] GenerateQrRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.text))
        return Results.BadRequest(new { error = "'text' is required" });

    var format = (req.format ?? "png").ToLowerInvariant();
    var ppm = req.pixelsPerModule is > 0 and <= 50 ? req.pixelsPerModule.Value : 10;

    // Generate QR data
    var generator = new QRCodeGenerator();
    var data = generator.CreateQrCode(req.text, QRCodeGenerator.ECCLevel.M);

    if (format == "svg")
    {
        var svg = new SvgQRCode(data).GetGraphic(ppm);
        var svgEscaped = Uri.EscapeDataString(svg);
        var dataUrl = $"data:image/svg+xml;utf8,{svgEscaped}";
        return Results.Ok(new GenerateQrResponse(dataUrl, "image/svg+xml", ppm, "svg"));
    }
    else
    {
        var pngBytes = new PngByteQRCode(data).GetGraphic(ppm);
        var base64 = Convert.ToBase64String(pngBytes);
        var dataUrl = $"data:image/png;base64,{base64}";
        return Results.Ok(new GenerateQrResponse(dataUrl, "image/png", ppm, "png"));
    }
})
.WithName("GenerateQr")
.Produces<GenerateQrResponse>(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest);

app.Run();
```

> **Why Data URLs?** Returning a Data URL (`data:image/png;base64,…`) makes the React side trivial—just set it on an `<img src="…" />`.

### 2.4 Run the API on a fixed port

To avoid random dev ports, run Kestrel on `http://localhost:5055` during dev:

```bash
dotnet run --urls http://localhost:5055
```

You should see something like:

```
Now listening on: http://localhost:5055
```

> Swagger UI: open http://localhost:5055/swagger to test the endpoint. Use:
>
> ```json
> {
>   "text": "Hello QR!",
>   "format": "png",
>   "pixelsPerModule": 10
> }
> ```

Leave the API running.

---

## 3) Frontend – React + Vite + TypeScript + Tailwind

Open a new terminal **at the repo root** (`qrcode-fullstack/`).

### 3.1 Scaffold Vite React app

```bash
mkdir client
cd client
npm create vite@latest . -- --template react-ts
npm install
```

### 3.2 Add Tailwind CSS

```bash
npm install tailwindcss @tailwindcss/vite
```

Edit **vite.config.ts**:

```js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

Replace **src/index.css** with:

```css
@import "tailwindcss";
```

### 3.3 Configure API base URL

Create **.env** in `client/`:

```bash
VITE_API_BASE_URL=http://localhost:5055
```

### 3.4 Replace the app code

Replace **src/App.tsx** with:

```tsx
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
```

Replace **src/main.tsx** with:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 3.5 Run the client

```bash
npm run dev
```

Open the printed URL (usually `http://localhost:5173`).

> Type some text, click **Generate QR**, preview appears, then **Download**.

---

## 4) Quick tests (without the UI)

### curl

```bash
curl -s -X POST http://localhost:5055/api/qr \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from curl","format":"png","pixelsPerModule":10}' | jq ".dataUrl | .[0:60] + \"...\""
```

You should see a `data:image/png;base64,` prefix.

### Swagger

Visit **http://localhost:5055/swagger** and try the `POST /api/qr` endpoint.

---


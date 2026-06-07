"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Transaction {
  transaction_id: string;
  timestamp: string;
  type: string;
  merchant_recipient: string | null;
  amount: number;
  status: string;
  error_code: string | null;
  internal_note: string | null;
  risk_score: number | null;
  card_is_frozen: boolean;
  bin: string | null;
}

interface BinInfo {
  bin: string;
  issuer: string;
  brand: string;
  type: string;
  country: string;
  country_iso2: string;
  categories: string[];
  is_valid: boolean;
}

interface Performance {
  model: string;
  llmLatencyMs: number;
  dbLatencyMs: number;
  totalLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  stopReason: string | null;
  estimatedCostUsd: number;
}

const CTA_LABELS: Record<string, string> = {
  UNLOCK_CARD: "Desbloquear tarjeta",
  ADD_FUNDS: "Agregar fondos",
  TRY_AGAIN: "Intentar de nuevo",
  CONTACT_SUPPORT: "Contactar soporte",
  CONFIRM_TRANSACTION: "Confirmar transacción",
  VERIFY_CARD_INFO: "Verificar datos de tarjeta",
};

interface ExplainResponse {
  transaction: Transaction;
  binInfo: BinInfo | null;
  explanation: { es: string; en: string; cta?: string };
  performance: Performance;
  error?: string;
}

function MetricTile({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div className="bg-background/60 rounded-lg p-3 border border-border">
      <p className="text-muted-foreground text-xs font-medium mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
        {unit && <span className="text-muted-foreground text-xs font-normal ml-1">{unit}</span>}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground text-sm font-medium">{label}</dt>
      <dd className="text-foreground text-sm">{value}</dd>
    </>
  );
}

const STATUS_ES: Record<string, string> = {
  completed: "Completada",
  pending: "En proceso",
  failed: "No completada",
  declined: "No completada",
  flagged: "En revisión",
};

function StatusBadge({ status, es = false }: { status: string; es?: boolean }) {
  const s = status.toLowerCase();
  const label = es ? (STATUS_ES[s] ?? status) : status;
  if (s === "completed")
    return <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">{label}</Badge>;
  if (s === "pending")
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">{label}</Badge>;
  if (s === "flagged")
    return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/20">{label}</Badge>;
  return <Badge variant="destructive">{label}</Badge>;
}

export default function Home() {
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [perfTooltip, setPerfTooltip] = useState(false);
  const [perfPos, setPerfPos] = useState({ top: 0, left: 0 });
  const perfRef = React.useRef<HTMLButtonElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transactionId.trim() }),
      });

      const data: ExplainResponse = await res.json();

      if (!res.ok) {
        setError(data.error ?? "An unexpected error occurred.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-2 h-6 rounded-full bg-primary" />
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Rafa&apos;s Smart Transaction Helper
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {/* Search — always visible */}
        <div className="max-w-xl mx-auto space-y-3">
          <p className="text-muted-foreground text-sm text-center">
            Enter a transaction ID to get an AI-generated failure analysis.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g. TX-5B1004B5"
              className="text-foreground bg-card border-border placeholder:text-muted-foreground focus-visible:ring-primary"
              required
            />
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-6 shrink-0"
            >
              {loading ? "Looking up…" : "Look up"}
            </Button>
          </form>
          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}
        </div>

        {/* View toggle + results */}
        <Tabs defaultValue="customer">
          <div className="flex justify-center">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="customer" className="px-6 text-sm font-medium">
                Común app
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="px-6 text-sm font-medium">
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="internal" className="px-6 text-sm font-medium">
                Internal
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── INTERNAL VIEW ── */}
          <TabsContent value="internal">
            {!result && (
              <div className="mt-12 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-semibold">No transaction loaded</p>
                  <p className="text-muted-foreground text-xs max-w-xs">
                    Enter a transaction ID above to see the full internal breakdown — details, card issuer, AI explanation, and performance metrics.
                  </p>
                </div>
                <div className="flex gap-2 mt-1">
                  {["TX-5B1004B5", "TX-869F51CD"].map((id) => (
                    <button
                      key={id}
                      onClick={() => setTransactionId(id)}
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors font-mono"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {result && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Transaction Details */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        Transaction Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <Row label="ID" value={<span className="font-mono font-bold text-xs text-primary">{result.transaction.transaction_id}</span>} />
                        <Row label="Date" value={new Date(result.transaction.timestamp).toLocaleString("en-US")} />
                        <Row label="Type" value={result.transaction.type} />
                        <Row label="Merchant" value={result.transaction.merchant_recipient ?? "—"} />
                        <Row label="Amount" value={<span className="font-bold">{result.transaction.amount}</span>} />
                        <Row label="Status" value={<StatusBadge status={result.transaction.status} />} />
                        <Row label="Error Code" value={<span className="font-mono text-xs">{result.transaction.error_code ?? "—"}</span>} />
                        <Row label="Risk Score" value={result.transaction.risk_score ?? "—"} />
                        <Row
                          label="Card Frozen"
                          value={
                            result.transaction.card_is_frozen
                              ? <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">Yes</Badge>
                              : <span className="text-muted-foreground">No</span>
                          }
                        />
                        <Row label="BIN" value={<span className="font-mono text-xs">{result.transaction.bin ?? "—"}</span>} />
                      </dl>
                      {result.transaction.internal_note && (
                        <>
                          <Separator className="my-3 bg-border" />
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <span className="text-foreground font-medium">Internal note: </span>
                            {result.transaction.internal_note}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card Issuer */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        Card Issuer
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {result.binInfo ? (
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <Row label="Issuer" value={<span className="font-bold text-primary">{result.binInfo.issuer}</span>} />
                          <Row label="Brand" value={result.binInfo.brand} />
                          <Row label="Card Type" value={<span className="capitalize">{result.binInfo.type}</span>} />
                          <Row
                            label="Country"
                            value={
                              <span className="flex items-center gap-1.5">
                                <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{result.binInfo.country_iso2}</span>
                                {result.binInfo.country}
                              </span>
                            }
                          />
                          <Row
                            label="Categories"
                            value={
                              <div className="flex flex-wrap gap-1">
                                {result.binInfo.categories.map((c) => (
                                  <Badge key={c} variant="outline" className="text-xs capitalize border-border text-muted-foreground">
                                    {c}
                                  </Badge>
                                ))}
                              </div>
                            }
                          />
                          <Row
                            label="BIN Valid"
                            value={
                              result.binInfo.is_valid
                                ? <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">Valid</Badge>
                                : <Badge variant="destructive">Invalid</Badge>
                            }
                          />
                        </dl>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                          {result.transaction.bin
                            ? "Could not retrieve issuer info."
                            : "No BIN available for this transaction."}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* AI Explanation */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        AI Explanation
                      </CardTitle>
                      <div className="flex rounded-md overflow-hidden border border-border text-xs font-semibold">
                        <button
                          onClick={() => setLang("es")}
                          className={`px-3 py-1.5 transition-colors ${lang === "es" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                          ES
                        </button>
                        <button
                          onClick={() => setLang("en")}
                          className={`px-3 py-1.5 transition-colors ${lang === "en" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                          EN
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 overflow-visible">
                    <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
                      {result.explanation[lang]}
                    </p>
                    {result.explanation.cta && CTA_LABELS[result.explanation.cta] && (
                      <button className="inline-flex items-center rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary">
                        {CTA_LABELS[result.explanation.cta]}
                      </button>
                    )}
                    <button
                      ref={perfRef}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
                      onMouseEnter={() => {
                        const rect = perfRef.current?.getBoundingClientRect();
                        if (rect) setPerfPos({ top: rect.bottom + 8, left: rect.left });
                        setPerfTooltip(true);
                      }}
                      onMouseLeave={() => setPerfTooltip(false)}
                    >
                      ⚡ {result.performance.totalLatencyMs}ms · {result.performance.totalTokens} tokens
                    </button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ── CUSTOMER VIEW ── */}
          <TabsContent value="customer">
            <div className="flex justify-center mt-8">
              {/* iPhone frame */}
              <div className="relative w-[390px]" style={{ filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.8))" }}>
                {/* Outer bezel */}
                <div className="bg-[#1a1a1a] rounded-[52px] p-[10px] border border-[#3a3a3a] shadow-2xl">
                  {/* Side buttons (decorative) */}
                  <div className="absolute -left-[3px] top-[108px] w-[3px] h-8 bg-[#2a2a2a] rounded-l-sm" />
                  <div className="absolute -left-[3px] top-[152px] w-[3px] h-10 bg-[#2a2a2a] rounded-l-sm" />
                  <div className="absolute -left-[3px] top-[198px] w-[3px] h-10 bg-[#2a2a2a] rounded-l-sm" />
                  <div className="absolute -right-[3px] top-[160px] w-[3px] h-14 bg-[#2a2a2a] rounded-r-sm" />

                  {/* Screen */}
                  <div className="bg-[#0a0a0a] rounded-[44px] overflow-hidden h-[780px] relative flex flex-col">
                    {/* Status bar */}
                    <div className="flex items-start justify-between px-8 pt-4 pb-1 shrink-0">
                      <span className="text-white text-xs font-semibold">9:41</span>
                      {/* Dynamic island */}
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[120px] h-[34px] bg-black rounded-full" />
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-3 text-white fill-current" viewBox="0 0 24 16"><rect x="0" y="4" width="3" height="12" rx="1"/><rect x="5" y="2" width="3" height="14" rx="1"/><rect x="10" y="0" width="3" height="16" rx="1"/><rect x="15" y="0" width="3" height="16" rx="1" opacity=".4"/></svg>
                        <svg className="w-4 h-3 text-white fill-current" viewBox="0 0 24 16"><path d="M12 2C6.5 2 2 5.5 2 10s4.5 8 10 8 10-3.5 10-8-4.5-8-10-8zm0 2c4 0 7.4 2.5 8 6H4c.6-3.5 4-6 8-6z"/></svg>
                        <svg className="w-6 h-3 text-white fill-current" viewBox="0 0 25 12"><rect x="0" y="1" width="22" height="10" rx="2" stroke="white" strokeWidth="1" fill="none"/><rect x="1" y="2" width="17" height="8" rx="1" fill="white"/><rect x="23" y="3.5" width="2" height="5" rx="1" fill="white" opacity=".4"/></svg>
                      </div>
                    </div>

                    {/* App content */}
                    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
                      {!result ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                          {error ? (
                            <>
                              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                                <span className="text-destructive text-xl">!</span>
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground text-sm font-semibold">Transacción no encontrada</p>
                                <p className="text-muted-foreground text-xs max-w-[220px]">No pudimos encontrar esa transacción. Verifica el ID e intenta de nuevo.</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-primary/40" />
                              </div>
                              <p className="text-muted-foreground text-sm">
                                Look up a transaction to see the customer view.
                              </p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {/* App name */}
                          <div className="flex items-center gap-2 pt-1">
                            <div className="w-1.5 h-5 rounded-full bg-primary" />
                            <span className="text-white text-sm font-bold">Común</span>
                          </div>

                          {/* Transaction header */}
                          <div>
                            <p className="text-muted-foreground text-xs font-medium mb-1">
                              {result.transaction.type}
                              {result.transaction.merchant_recipient ? ` · ${result.transaction.merchant_recipient}` : ""}
                            </p>
                            <p className="text-white text-3xl font-bold">
                              ${result.transaction.amount}
                            </p>
                            <p className="text-muted-foreground text-xs mt-1">
                              {new Date(result.transaction.timestamp).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          </div>

                          {/* Status badge */}
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs font-medium">Estado:</span>
                            <StatusBadge
                              status={result.transaction.error_code === "CARD_LOCK" && result.transaction.status.toLowerCase() !== "flagged" ? "failed" : result.transaction.status}
                              es
                            />
                          </div>

                          <Separator className="bg-border/50" />

                          {/* Spanish explanation */}
                          <div className="space-y-2">
                            <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
                              ¿Qué pasó?
                            </p>
                            <p className="text-white text-sm leading-relaxed">
                              {result.explanation.es}
                            </p>
                          </div>

                          {/* CTA */}
                          {result.explanation.cta && CTA_LABELS[result.explanation.cta] && (
                            <button className="w-full bg-primary text-primary-foreground font-semibold text-sm rounded-2xl py-3.5 mt-2">
                              {CTA_LABELS[result.explanation.cta]}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Home indicator */}
                    <div className="flex justify-center pb-3 shrink-0">
                      <div className="w-32 h-1 bg-white/30 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── WHATSAPP VIEW ── */}
          <TabsContent value="whatsapp">
            <div className="flex justify-center mt-8">
              <div className="relative w-[390px]" style={{ filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.8))" }}>
                {/* iPhone outer bezel */}
                <div className="bg-[#1a1a1a] rounded-[52px] p-[10px] border border-[#3a3a3a] shadow-2xl">
                  {/* Side buttons */}
                  <div className="absolute -left-[3px] top-[108px] w-[3px] h-8 bg-[#2a2a2a] rounded-l-sm" />
                  <div className="absolute -left-[3px] top-[152px] w-[3px] h-10 bg-[#2a2a2a] rounded-l-sm" />
                  <div className="absolute -left-[3px] top-[198px] w-[3px] h-10 bg-[#2a2a2a] rounded-l-sm" />
                  <div className="absolute -right-[3px] top-[160px] w-[3px] h-14 bg-[#2a2a2a] rounded-r-sm" />
                  {/* Screen */}
                  <div className="rounded-[44px] overflow-hidden">

                {/* WhatsApp header */}
                <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: "#075E54" }}>
                  {/* Back arrow */}
                  <svg className="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-primary-foreground text-sm font-bold">C</span>
                  </div>
                  {/* Name + verified */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-white text-sm font-semibold">Común</span>
                      {/* Verified business badge */}
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="10" fill="#25D366"/>
                        <path d="M6 10.5l2.5 2.5 5.5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p className="text-white/70 text-xs">Cuenta oficial de negocios</p>
                  </div>
                  {/* Action icons */}
                  <div className="flex items-center gap-4 shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.47 11.47 0 003.58.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.47 11.47 0 00.57 3.58 1 1 0 01-.25 1.02l-2.2 2.19z"/>
                    </svg>
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                    </svg>
                  </div>
                </div>

                {/* Chat area */}
                <div className="flex flex-col h-[680px]" style={{ backgroundColor: "#ECE5DD" }}>
                  {/* Background pattern overlay */}
                  <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">

                    {!result ? (
                      <div className="flex flex-col gap-3">
                        {error ? (
                          <>
                            {/* User outgoing message */}
                            <div className="flex justify-end">
                              <div className="rounded-tl-2xl rounded-tr-sm rounded-bl-2xl rounded-br-2xl px-3 py-2 shadow-sm max-w-[72%]" style={{ backgroundColor: "#DCF8C6" }}>
                                <p className="text-gray-800 text-[12.5px] leading-relaxed">
                                  Hola, ¿me pueden ayudar? Estoy viendo un problema con mi transacción {transactionId}. ¿Qué pasó? 🙏
                                </p>
                                <div className="flex justify-end items-center gap-1 mt-1">
                                  <span className="text-gray-400 text-[10px]">ahora</span>
                                  <span className="text-[#4FC3F7] text-xs font-bold leading-none">✓✓</span>
                                </div>
                              </div>
                            </div>
                            {/* Común error response */}
                            <div className="flex items-end gap-1 max-w-[85%]">
                              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mb-1">
                                <span className="text-primary-foreground text-[9px] font-bold">C</span>
                              </div>
                              <div className="bg-white rounded-tr-2xl rounded-br-2xl rounded-bl-sm rounded-tl-2xl px-3 py-2.5 shadow-sm">
                                <p className="text-gray-800 text-[12.5px] leading-relaxed">No encontramos esa transacción. Por favor verifica el ID e intenta de nuevo.</p>
                                <div className="flex justify-end items-center gap-1 mt-1">
                                  <span className="text-gray-400 text-[10px]">ahora</span>
                                  <span className="text-[#4FC3F7] text-xs font-bold leading-none">✓✓</span>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-3 text-center mt-20">
                            <div className="bg-white rounded-2xl px-5 py-4 shadow-sm max-w-[280px]">
                              <p className="text-[#075E54] text-sm font-medium">Hola 👋</p>
                              <p className="text-gray-500 text-xs mt-1">Busca una transacción para ver la vista de WhatsApp.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {/* Date chip */}
                        <div className="flex justify-center">
                          <span className="bg-white/70 text-gray-500 text-[11px] px-3 py-1 rounded-full shadow-sm">
                            {new Date(result.transaction.timestamp).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                        </div>

                        {/* Outgoing user message */}
                        <div className="flex justify-end">
                          <div className="rounded-tl-2xl rounded-tr-sm rounded-bl-2xl rounded-br-2xl px-3 py-2 shadow-sm max-w-[72%]" style={{ backgroundColor: "#DCF8C6" }}>
                            <p className="text-gray-800 text-[12.5px] leading-relaxed">
                              Hola, ¿me pueden ayudar? Estoy viendo un problema con mi transacción {result.transaction.transaction_id}. ¿Qué pasó? 🙏
                            </p>
                            <div className="flex justify-end items-center gap-1 mt-1">
                              <span className="text-gray-400 text-[10px]">
                                {new Date(result.transaction.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="text-[#4FC3F7] text-xs font-bold leading-none">✓✓</span>
                            </div>
                          </div>
                        </div>

                        {/* Incoming message bubble */}
                        <div className="flex items-end gap-1 max-w-[85%]">
                          {/* Avatar */}
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mb-1">
                            <span className="text-primary-foreground text-[9px] font-bold">C</span>
                          </div>

                          <div className="bg-white rounded-tr-2xl rounded-br-2xl rounded-bl-sm rounded-tl-2xl shadow-sm overflow-hidden" style={{ minWidth: "200px" }}>
                            {/* Metadata — plain text, WhatsApp-accurate */}
                            <div className="px-3 pt-3 pb-2 space-y-0.5">
                              <p className="text-[#075E54] text-[11px] font-semibold mb-1.5">Común · Detalle de transacción</p>
                              <p className="text-gray-700 text-[12px]"><span className="font-semibold">Fecha:</span> {new Date(result.transaction.timestamp).toLocaleDateString("es-MX")}</p>
                              <p className="text-gray-700 text-[12px]"><span className="font-semibold">Tipo:</span> {result.transaction.type}</p>
                              {result.transaction.merchant_recipient && (
                                <p className="text-gray-700 text-[12px]"><span className="font-semibold">Comercio:</span> {result.transaction.merchant_recipient}</p>
                              )}
                              <p className="text-gray-700 text-[12px]"><span className="font-semibold">Monto:</span> ${result.transaction.amount}</p>
                            </div>

                            {/* Status — separated, plain text label + badge */}
                            <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
                              <span className="text-gray-500 text-[12px] font-semibold">Estado:</span>
                              <StatusBadge
                                status={result.transaction.error_code === "CARD_LOCK" && result.transaction.status.toLowerCase() !== "flagged" ? "failed" : result.transaction.status}
                                es
                              />
                            </div>

                            {/* Spanish explanation */}
                            <div className="px-3 py-2.5">
                              <p className="text-gray-800 text-[12.5px] leading-relaxed">
                                {result.explanation.es}
                              </p>
                            </div>

                            {/* Timestamp + ticks */}
                            <div className="flex justify-end items-center gap-1 px-3 pb-2">
                              <span className="text-gray-400 text-[10px]">
                                {new Date(result.transaction.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="text-[#4FC3F7] text-xs font-bold leading-none">✓✓</span>
                            </div>
                          </div>
                        </div>

                        {/* CTA button — outside bubble, WhatsApp-style interactive button */}
                        {result.explanation.cta && CTA_LABELS[result.explanation.cta] && (
                          <div className="ml-7">
                            <button
                              className="w-full bg-white rounded-xl py-2.5 px-4 text-sm font-semibold shadow-sm text-center border"
                              style={{ color: "#25D366", borderColor: "#25D366" }}
                            >
                              {CTA_LABELS[result.explanation.cta]}
                            </button>
                          </div>
                        )}

                      </div>
                    )}
                  </div>

                  {/* Input bar */}
                  <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ backgroundColor: "#ECE5DD" }}>
                    <div className="flex-1 bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-sm">
                      <svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                      </svg>
                      <span className="text-gray-400 text-sm flex-1">Escribe un mensaje</span>
                      <svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/>
                      </svg>
                    </div>
                    <button className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#25D366" }}>
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    </button>
                  </div>
                </div>
                  {/* Home indicator */}
                  <div className="flex justify-center py-2 bg-[#ECE5DD]">
                    <div className="w-32 h-1 bg-black/20 rounded-full" />
                  </div>
                </div>{/* end screen */}
                </div>{/* end bezel */}
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {/* Performance tooltip — fixed so it escapes all overflow containers */}
      {perfTooltip && result && (
        <div
          className="fixed z-[9999] w-56 rounded-lg border border-[#2a2a2a] bg-[#141414] shadow-xl overflow-hidden pointer-events-none"
          style={{ top: perfPos.top, left: perfPos.left }}
        >
          <div className="px-3 py-2 border-b border-[#2a2a2a]">
            <p className="text-[10px] font-semibold text-[#888] uppercase tracking-widest">Performance</p>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {[
              ["Total latency", `${result.performance.totalLatencyMs}ms`, false],
              ["LLM latency", `${result.performance.llmLatencyMs}ms`, false],
              ["DB + BIN", `${result.performance.dbLatencyMs}ms`, false],
              ["Tokens", `${result.performance.totalTokens} (${result.performance.inputTokens} · ${result.performance.outputTokens})`, false],
              ["Est. cost", `$${result.performance.estimatedCostUsd.toFixed(6)}`, true],
              ["Model", result.performance.model, true],
            ].map(([label, value, accent]) => (
              <div key={String(label)} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#888] shrink-0">{label}</span>
                <span className={`text-[11px] font-medium font-mono truncate ${accent ? "text-[#7eda2c]" : "text-white"}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

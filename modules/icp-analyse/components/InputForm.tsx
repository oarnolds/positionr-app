"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  startICPAnalysis,
  createClientForUser,
  checkExistingICP,
} from "@/app/(app)/modules/icp-analyse/actions";
import { RerunDialog } from "./RerunDialog";

type ClientOption = { id: string; name: string; websiteUrl: string | null };

export function InputForm({ clients }: { clients: ClientOption[] }) {
  const [mode, setMode] = useState<"existing" | "new">(
    clients.length > 0 ? "existing" : "new"
  );
  const [selectedClientId, setSelectedClientId] = useState<string>(
    clients[0]?.id ?? ""
  );
  const [newClientName, setNewClientName] = useState("");
  const [newClientUrl, setNewClientUrl] = useState("");
  const [product, setProduct] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [rerunInfo, setRerunInfo] = useState<{
    runAt: string;
    clientId: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    let clientId = selectedClientId;
    if (mode === "new") {
      try {
        const fd = new FormData();
        fd.set("name", newClientName);
        fd.set("websiteUrl", newClientUrl);
        const created = await createClientForUser(fd);
        clientId = created.id;
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Klant aanmaken mislukt"
        );
        return;
      }
    }

    if (!clientId) {
      setErrorMsg("Kies een klant of maak een nieuwe aan.");
      return;
    }

    const existing = await checkExistingICP(clientId, product);
    if (existing.exists) {
      setRerunInfo({ runAt: existing.runAt!, clientId });
      return;
    }

    submitToServer(clientId, "new");
  }

  function submitToServer(
    clientId: string,
    runIntent: "new" | "replace" | "version" | "topic"
  ) {
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("product", product);
    fd.set("productDescription", productDescription);
    fd.set("runIntent", runIntent);
    startTransition(() => {
      startICPAnalysis(fd);
    });
  }

  function handleRerunChoice(intent: "replace" | "version" | "topic") {
    if (!rerunInfo) return;
    const cid = rerunInfo.clientId;
    setRerunInfo(null);
    submitToServer(cid, intent);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900">
            Klant
          </legend>

          {clients.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`rounded-lg px-3 py-1 text-sm ${
                  mode === "existing"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Bestaande klant
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`rounded-lg px-3 py-1 text-sm ${
                  mode === "new"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                + Nieuwe klant
              </button>
            </div>
          )}

          {mode === "existing" && clients.length > 0 ? (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.websiteUrl ? `— ${c.websiteUrl}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Bedrijfsnaam"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                required={mode === "new"}
              />
              <Input
                type="url"
                placeholder="https://example.com"
                value={newClientUrl}
                onChange={(e) => setNewClientUrl(e.target.value)}
                required={mode === "new"}
              />
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900">
            Product / Dienst
          </legend>
          <Input
            placeholder="Naam van product of dienst"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            required
          />
          <textarea
            placeholder="Korte omschrijving (10-1000 tekens) — wat is het, voor wie?"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </fieldset>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Bezig met analyse..." : "Start ICP-analyse"}
        </Button>
      </form>

      {rerunInfo && (
        <RerunDialog
          previousRunAt={rerunInfo.runAt}
          product={product}
          onChoose={handleRerunChoice}
          onCancel={() => setRerunInfo(null)}
        />
      )}
    </>
  );
}

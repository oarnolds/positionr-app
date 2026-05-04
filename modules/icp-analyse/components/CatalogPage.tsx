"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Globe,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createClientForUser,
  scanWebsiteAction,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/app/(app)/modules/icp-analyse/actions";

type ClientOption = { id: string; name: string; websiteUrl: string | null };
type Product = {
  id: string;
  name: string;
  description: string | null;
  prominentie: "hoog" | "middel" | "laag";
};

export function CatalogPage({
  clients,
  activeClient,
  products,
}: {
  clients: ClientOption[];
  activeClient: ClientOption | null;
  products: Product[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scanUrl, setScanUrl] = useState(activeClient?.websiteUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);

  async function handleCreateClient(formData: FormData) {
    setError(null);
    try {
      const result = await createClientForUser(formData);
      router.push(`/modules/icp-analyse?clientId=${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt");
    }
  }

  async function handleScan() {
    if (!activeClient || !scanUrl.trim()) {
      setError("Kies eerst een klant en vul een URL in");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await scanWebsiteAction(activeClient.id, scanUrl);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan mislukt");
      }
    });
  }

  function startAnalyse(productId: string) {
    router.push(`/modules/icp-analyse/${productId}`);
  }

  return (
    <div className="space-y-6">
      {/* Bedrijfsprofiel — read-only of inline-aanmaak voor nieuwe gebruikers */}
      {activeClient ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Uw bedrijf
            </span>
            <span className="text-base font-semibold text-gray-900">
              {activeClient.name}
            </span>
            {activeClient.websiteUrl && (
              <span className="text-sm text-gray-500">
                — {activeClient.websiteUrl}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50/50 p-5">
          <h2 className="text-base font-semibold text-gray-900">
            Vul eerst je bedrijfsgegevens in
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Eén keer instellen — daarna start je analyses op je eigen website.
          </p>
          <form
            action={handleCreateClient}
            className="mt-3 flex flex-wrap gap-2"
          >
            <Input
              name="name"
              placeholder="Bedrijfsnaam"
              required
              className="flex-1 min-w-[180px] bg-white"
            />
            <Input
              name="websiteUrl"
              placeholder="www.example.com"
              required
              className="flex-1 min-w-[180px] bg-white"
            />
            <Button type="submit" size="default">
              Opslaan
            </Button>
          </form>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {activeClient && (
        <>
          {/* Scan-blok */}
          <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-100 p-2.5 text-blue-600">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-900">
                  Website scannen
                </h2>
                <p className="text-sm text-gray-600">
                  Laat de AI automatisch de producten en diensten detecteren vanuit de
                  website.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    value={scanUrl}
                    onChange={(e) => setScanUrl(e.target.value)}
                    placeholder="www.example.com"
                    className="min-w-[220px] flex-1 bg-white"
                  />
                  <Button
                    onClick={handleScan}
                    disabled={pending}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {pending ? "Scannen..." : "Scan website"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Catalogus */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Catalogus{" "}
                <span className="text-sm font-normal text-gray-500">
                  ({products.length} {products.length === 1 ? "item" : "items"})
                </span>
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreatingProduct(true)}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Handmatig toevoegen
              </Button>
            </div>

            {products.length === 0 ? (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm text-gray-600">
                  Nog geen producten — scan de website of voeg er handmatig één toe.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onAnalyse={() => startAnalyse(p.id)}
                    onEdit={() => setEditingProduct(p)}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {(creatingProduct || editingProduct) && activeClient && (
        <ProductDialog
          clientId={activeClient.id}
          existing={editingProduct}
          onClose={() => {
            setCreatingProduct(false);
            setEditingProduct(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProductRow({
  product,
  onAnalyse,
  onEdit,
}: {
  product: Product;
  onAnalyse: () => void;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(`Product "${product.name}" verwijderen?`)) return;
    startTransition(async () => {
      try {
        await deleteProduct(product.id);
        router.refresh();
      } catch {
        alert("Verwijderen mislukt");
      }
    });
  }

  const promColor =
    product.prominentie === "hoog"
      ? "bg-blue-100 text-blue-700"
      : product.prominentie === "middel"
      ? "bg-amber-100 text-amber-700"
      : "bg-gray-100 text-gray-600";

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-gray-900">
            {product.name}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs capitalize ${promColor}`}
          >
            {product.prominentie}
          </span>
        </div>
        {product.description && (
          <p className="mt-1 text-sm text-gray-600">{product.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onAnalyse} className="gap-1">
          <BarChart3 className="h-4 w-4" />
          ICP Analyse
        </Button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
          title="Bewerken"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
          title="Verwijderen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function ProductDialog({
  clientId,
  existing,
  onClose,
}: {
  clientId: string;
  existing: Product | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [prominentie, setProminentie] = useState<
    "hoog" | "middel" | "laag"
  >(existing?.prominentie ?? "middel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        if (existing) {
          await updateProduct({
            id: existing.id,
            name,
            description,
            prominentie,
          });
        } else {
          await createProduct({ clientId, name, description, prominentie });
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Opslaan mislukt");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">
          {existing ? "Product bewerken" : "Product handmatig toevoegen"}
        </h2>
        <div className="mt-4 space-y-3">
          <Input
            placeholder="Naam"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            placeholder="Beschrijving"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Prominentie:</span>
            <select
              value={prominentie}
              onChange={(e) =>
                setProminentie(e.target.value as "hoog" | "middel" | "laag")
              }
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="hoog">Hoog</option>
              <option value="middel">Middel</option>
              <option value="laag">Laag</option>
            </select>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              {error}
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={pending || name.length < 2}>
            {pending ? "Opslaan..." : "Opslaan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

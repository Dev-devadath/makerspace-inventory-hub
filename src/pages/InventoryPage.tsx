import { useEffect, useState } from "react";
import { Search, Package, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchLiveStock, invalidateCache, StockItem } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const LOW_STOCK_THRESHOLD = 3;

const InventoryPage = () => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStock = (forceRefresh = false) => {
    if (forceRefresh) {
      invalidateCache("getLiveStock");
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    fetchLiveStock()
      .then(setStock)
      .catch(() => toast.error("Failed to load inventory."))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = stock.filter((item) =>
    item.component.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Banner */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-primary/10 via-accent to-secondary/10 p-6 md:p-8 border border-primary/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm font-handwritten text-primary text-lg mb-1">
              est 2021 - Kochi
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight">
              Maker Station Inventory
            </h1>
            <p className="text-muted-foreground mt-1 max-w-lg">
              A playground for builders — browse all components available at
              TinkerSpace. Packed with tools for tinkering, experimenting, and
              creating something extraordinary.
            </p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Package className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by component name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadStock(true)}
          disabled={refreshing}
          className="shrink-0"
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* ── Loading overlay ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-24 shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-lg font-semibold text-foreground">
            Loading inventory...
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Fetching latest stock from the database
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden relative">
          {/* Subtle refreshing bar at the top */}
          {refreshing && (
            <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-t-xl">
              <div className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] bg-primary/40 rounded-full" />
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">#</TableHead>
                  <TableHead className="font-semibold">Component</TableHead>
                  <TableHead className="font-semibold text-center">
                    Stock
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No components found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item, i) => {
                    const isLow =
                      item.stock > 0 && item.stock <= LOW_STOCK_THRESHOLD;
                    const isOut = item.stock === 0;

                    return (
                      <TableRow
                        key={item.component}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="text-muted-foreground text-xs">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium text-card-foreground">
                          {item.component}
                        </TableCell>
                        <TableCell
                          className={`text-center font-mono text-sm font-semibold ${
                            isOut
                              ? "text-destructive"
                              : isLow
                                ? "text-secondary"
                                : "text-success"
                          }`}
                        >
                          {item.stock}
                        </TableCell>
                        <TableCell className="text-center">
                          {isOut ? (
                            <Badge
                              variant="destructive"
                              className="text-xs"
                            >
                              Out of stock
                            </Badge>
                          ) : isLow ? (
                            <Badge
                              variant="outline"
                              className="text-xs border-secondary text-secondary"
                            >
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Low stock
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs border-success text-success"
                            >
                              Available
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;

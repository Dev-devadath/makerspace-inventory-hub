import { useState } from "react";
import { CheckCircle, AlertCircle, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchUserHoldings, returnComponent, Holding } from "@/lib/api";
import { toast } from "sonner";

const ReturnPage = () => {
  const [userHubId, setUserHubId] = useState("");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedComponent, setSelectedComponent] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [looking, setLooking] = useState(false);
  const [looked, setLooked] = useState(false);

  const selectedHolding = holdings.find(
    (h) => h.component === selectedComponent,
  );

  const lookupHoldings = async () => {
    if (!userHubId.trim()) {
      toast.error("Enter your Hub ID first.");
      return;
    }

    setLooking(true);
    try {
      const data = await fetchUserHoldings(userHubId.trim());
      setHoldings(data);
      setSelectedComponent("");
      setQuantity(1);
      setLooked(true);
      if (data.length === 0) {
        toast.info("No active borrows found for this Hub ID.");
      }
    } catch {
      toast.error("Failed to fetch holdings. Please try again.");
    } finally {
      setLooking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!userHubId.trim()) {
      toast.error("Please enter your Hub ID.");
      return;
    }
    if (!selectedComponent) {
      toast.error("Please select a component to return.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Quantity must be a positive integer.");
      return;
    }
    if (selectedHolding && quantity > selectedHolding.outstanding) {
      toast.error(`You only have ${selectedHolding.outstanding} borrowed.`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await returnComponent(
        userHubId.trim(),
        selectedComponent,
        quantity,
      );

      if (result.success) {
        toast.success(result.message, {
          icon: <CheckCircle className="h-4 w-4" />,
        });
        // Refresh holdings
        const data = await fetchUserHoldings(userHubId.trim());
        setHoldings(data);
        setSelectedComponent("");
        setQuantity(1);
      } else {
        toast.error(result.message, {
          icon: <AlertCircle className="h-4 w-4" />,
        });
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-success/10 via-accent to-primary/5 p-6 border border-success/10">
          <p className="text-sm font-handwritten text-success text-lg mb-1">
            Keep the cycle going
          </p>
          <h1 className="text-2xl font-extrabold text-foreground">
            Return Component
          </h1>
          <p className="text-muted-foreground mt-1">
            Done building? Return components so others can tinker too.
          </p>
        </div>

        <div className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
          {/* Lookup */}
          <div className="space-y-2">
            <Label htmlFor="hubIdReturn">Your Hub ID</Label>
            <div className="flex gap-2">
              <Input
                id="hubIdReturn"
                placeholder="e.g. HUB101"
                value={userHubId}
                onChange={(e) => {
                  setUserHubId(e.target.value);
                  setLooked(false);
                }}
                maxLength={20}
              />
              <Button
                type="button"
                variant="outline"
                onClick={lookupHoldings}
                className="shrink-0"
                disabled={looking}
              >
                {looking ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-1 h-4 w-4" />
                )}
                Lookup
              </Button>
            </div>
          </div>

          {/* Holdings list */}
          {looked && holdings.length > 0 && (
            <>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Your Current Holdings
                </Label>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  {holdings.map((h) => (
                    <div
                      key={h.component}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-card-foreground">
                        {h.component}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        x{h.outstanding}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Component */}
                <div className="space-y-2">
                  <Label>Component to Return</Label>
                  <Select
                    value={selectedComponent}
                    onValueChange={(val) => {
                      setSelectedComponent(val);
                      setQuantity(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select component to return" />
                    </SelectTrigger>
                    <SelectContent>
                      {holdings.map((h) => (
                        <SelectItem key={h.component} value={h.component}>
                          {h.component} (x{h.outstanding})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <Label htmlFor="returnQty">Quantity to Return</Label>
                  <Input
                    id="returnQty"
                    type="number"
                    min={1}
                    max={selectedHolding?.outstanding || 1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                  {selectedHolding && (
                    <p className="text-xs text-muted-foreground">
                      You have {selectedHolding.outstanding} borrowed
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-success text-success-foreground hover:bg-success/90"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Returning...
                    </>
                  ) : (
                    "Return Component"
                  )}
                </Button>
              </form>
            </>
          )}

          {looked && holdings.length === 0 && (
            <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
              No active borrows found for <strong>{userHubId}</strong>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReturnPage;

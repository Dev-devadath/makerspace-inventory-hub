import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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
import { fetchCases, fetchComponentsByCase, borrowComponent } from "@/lib/api";
import { toast } from "sonner";

const BorrowPage = () => {
  const [cases, setCases] = useState<string[]>([]);
  const [components, setComponents] = useState<string[]>([]);
  const [userHubId, setUserHubId] = useState("");
  const [selectedCase, setSelectedCase] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingComponents, setLoadingComponents] = useState(false);

  // Load cases on mount
  useEffect(() => {
    setLoadingCases(true);
    fetchCases()
      .then(setCases)
      .catch(() => toast.error("Failed to load cases."))
      .finally(() => setLoadingCases(false));
  }, []);

  // Load components when case changes
  useEffect(() => {
    if (selectedCase) {
      setLoadingComponents(true);
      setSelectedComponent("");
      setComponents([]);
      fetchComponentsByCase(selectedCase)
        .then(setComponents)
        .catch(() => toast.error("Failed to load components."))
        .finally(() => setLoadingComponents(false));
    } else {
      setComponents([]);
      setSelectedComponent("");
    }
  }, [selectedCase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!userHubId.trim()) {
      toast.error("Please enter your Hub ID.");
      return;
    }
    if (!selectedCase) {
      toast.error("Please select a case.");
      return;
    }
    if (!selectedComponent) {
      toast.error("Please select a component.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Quantity must be a positive integer.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await borrowComponent(
        userHubId.trim(),
        selectedCase,
        selectedComponent,
        quantity,
      );

      if (result.success) {
        toast.success(result.message, {
          icon: <CheckCircle className="h-4 w-4" />,
        });
        // Reset form
        setUserHubId("");
        setSelectedCase("");
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
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-secondary/10 via-accent to-primary/5 p-6 border border-secondary/10">
          <p className="text-sm font-handwritten text-secondary text-lg mb-1">
            Maker vibes
          </p>
          <h1 className="text-2xl font-extrabold text-foreground">
            Borrow Component
          </h1>
          <p className="text-muted-foreground mt-1">
            Grab what you need to tinker, experiment, and create. Happy making!
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border bg-card p-6 shadow-sm"
        >
          {/* Hub ID */}
          <div className="space-y-2">
            <Label htmlFor="hubId">Your Hub ID</Label>
            <Input
              id="hubId"
              placeholder="e.g. HUB101"
              value={userHubId}
              onChange={(e) => setUserHubId(e.target.value)}
              maxLength={20}
            />
          </div>

          {/* Case */}
          <div className="space-y-2">
            <Label>Case</Label>
            <Select
              value={selectedCase}
              onValueChange={setSelectedCase}
              disabled={loadingCases}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingCases ? "Loading cases..." : "Select a case"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {cases.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Component */}
          <div className="space-y-2">
            <Label>Component</Label>
            <Select
              value={selectedComponent}
              onValueChange={setSelectedComponent}
              disabled={!selectedCase || loadingComponents}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedCase
                      ? "Select a case first"
                      : loadingComponents
                        ? "Loading components..."
                        : "Select component"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {components.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Borrowing...
              </>
            ) : (
              "Borrow Component"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default BorrowPage;

import { useEffect, useState } from "react";
import { Wrench, CheckCircle, AlertCircle } from "lucide-react";
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
import {
  fetchCases,
  fetchComponentsByCase,
  borrowComponent,
  Component,
} from "@/lib/api";
import { toast } from "sonner";

const BorrowPage = () => {
  const [cases, setCases] = useState<string[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [userHubId, setUserHubId] = useState("");
  const [selectedCase, setSelectedCase] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCases().then(setCases);
  }, []);

  useEffect(() => {
    if (selectedCase) {
      fetchComponentsByCase(selectedCase).then(setComponents);
      setSelectedComponentId("");
    } else {
      setComponents([]);
    }
  }, [selectedCase]);

  const selectedComponent = components.find((c) => c.id === selectedComponentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userHubId.trim() || !selectedComponentId || quantity < 1) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (selectedComponent && quantity > selectedComponent.availableStock) {
      toast.error(`Only ${selectedComponent.availableStock} available.`);
      return;
    }

    setSubmitting(true);
    const result = await borrowComponent(userHubId.trim(), selectedComponentId, quantity);
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message, { icon: <CheckCircle className="h-4 w-4" /> });
      setUserHubId("");
      setSelectedCase("");
      setSelectedComponentId("");
      setQuantity(1);
    } else {
      toast.error(result.message, { icon: <AlertCircle className="h-4 w-4" /> });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-secondary/10 via-accent to-primary/5 p-6 border border-secondary/10">
          <p className="text-sm font-handwritten text-secondary text-lg mb-1">Maker Thursday vibes ✨</p>
          <h1 className="text-2xl font-extrabold text-foreground">Borrow Component</h1>
          <p className="text-muted-foreground mt-1">
            Grab what you need to tinker, experiment, and create. Happy making!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
          {/* Hub ID */}
          <div className="space-y-2">
            <Label htmlFor="hubId">Your Hub ID</Label>
            <Input
              id="hubId"
              placeholder="e.g. TH001"
              value={userHubId}
              onChange={(e) => setUserHubId(e.target.value)}
              maxLength={20}
            />
          </div>

          {/* Case */}
          <div className="space-y-2">
            <Label>Case</Label>
            <Select value={selectedCase} onValueChange={setSelectedCase}>
              <SelectTrigger>
                <SelectValue placeholder="Select a case" />
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
              value={selectedComponentId}
              onValueChange={setSelectedComponentId}
              disabled={!selectedCase}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedCase ? "Select component" : "Select a case first"} />
              </SelectTrigger>
              <SelectContent>
                {components.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.availableStock} available)
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
              max={selectedComponent?.availableStock || 1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            {selectedComponent && (
              <p className="text-xs text-muted-foreground">
                {selectedComponent.availableStock} in stock
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
            disabled={submitting}
          >
            {submitting ? "Borrowing..." : "Borrow Component"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default BorrowPage;

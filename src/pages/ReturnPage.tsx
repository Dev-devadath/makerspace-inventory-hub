import { useState } from "react";
import { RotateCcw, CheckCircle, AlertCircle, Search } from "lucide-react";
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
import { fetchBorrowedByUser, returnComponent, BorrowRecord } from "@/lib/api";
import { toast } from "sonner";

const ReturnPage = () => {
  const [userHubId, setUserHubId] = useState("");
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [looked, setLooked] = useState(false);

  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  const lookupBorrowed = async () => {
    if (!userHubId.trim()) {
      toast.error("Enter your Hub ID first.");
      return;
    }
    const data = await fetchBorrowedByUser(userHubId.trim());
    setRecords(data);
    setSelectedRecordId("");
    setQuantity(1);
    setLooked(true);
    if (data.length === 0) {
      toast.info("No active borrows found for this Hub ID.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId || quantity < 1) {
      toast.error("Please select a component and quantity.");
      return;
    }
    if (selectedRecord && quantity > selectedRecord.quantity) {
      toast.error(`You only borrowed ${selectedRecord.quantity}.`);
      return;
    }

    setSubmitting(true);
    const result = await returnComponent(selectedRecordId, quantity);
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message, { icon: <CheckCircle className="h-4 w-4" /> });
      // Refresh
      const data = await fetchBorrowedByUser(userHubId.trim());
      setRecords(data);
      setSelectedRecordId("");
      setQuantity(1);
    } else {
      toast.error(result.message, { icon: <AlertCircle className="h-4 w-4" /> });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-success/10 via-accent to-primary/5 p-6 border border-success/10">
          <p className="text-sm font-handwritten text-success text-lg mb-1">Keep the cycle going 🔄</p>
          <h1 className="text-2xl font-extrabold text-foreground">Return Component</h1>
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
                placeholder="e.g. TH001"
                value={userHubId}
                onChange={(e) => {
                  setUserHubId(e.target.value);
                  setLooked(false);
                }}
                maxLength={20}
              />
              <Button type="button" variant="outline" onClick={lookupBorrowed} className="shrink-0">
                <Search className="mr-1 h-4 w-4" />
                Lookup
              </Button>
            </div>
          </div>

          {looked && records.length > 0 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Component */}
              <div className="space-y-2">
                <Label>Borrowed Component</Label>
                <Select value={selectedRecordId} onValueChange={setSelectedRecordId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select component to return" />
                  </SelectTrigger>
                  <SelectContent>
                    {records.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.componentName} (×{r.quantity})
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
                  max={selectedRecord?.quantity || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                {selectedRecord && (
                  <p className="text-xs text-muted-foreground">
                    You have {selectedRecord.quantity} borrowed
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-success text-success-foreground hover:bg-success/90"
                disabled={submitting}
              >
                {submitting ? "Returning..." : "Return Component"}
              </Button>
            </form>
          )}

          {looked && records.length === 0 && (
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

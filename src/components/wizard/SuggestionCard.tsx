import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Pencil, X } from "lucide-react";
import { Suggestion } from "@/types/story";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onDiscard: (id: string) => void;
  showOriginal?: boolean;
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onEdit,
  onDiscard,
  showOriginal = false,
}: SuggestionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(suggestion.editedText || suggestion.suggested);

  const handleSaveEdit = () => {
    onEdit(suggestion.id, editText);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(suggestion.editedText || suggestion.suggested);
    setIsEditing(false);
  };

  const displayText = suggestion.status === 'edited' 
    ? suggestion.editedText 
    : suggestion.suggested;

  if (suggestion.status === 'discarded') {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 opacity-50">
        <p className="text-sm text-muted-foreground line-through">{suggestion.suggested}</p>
        <p className="text-xs text-muted-foreground mt-2">Verworfen</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-card transition-all duration-200 animate-fade-in",
        suggestion.status === 'accepted' && "border-success/50 bg-success/5",
        suggestion.status === 'edited' && "border-primary/50 bg-primary/5",
        suggestion.status === 'pending' && "border-border hover:border-primary/30"
      )}
    >
      {showOriginal && suggestion.original && (
        <div className="mb-3 pb-3 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Original:</p>
          <p className="text-sm text-muted-foreground">{suggestion.original}</p>
        </div>
      )}

      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="min-h-[100px] text-sm"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>
              Speichern
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground whitespace-pre-wrap">{displayText}</p>

          {suggestion.status === 'accepted' && (
            <p className="text-xs text-success mt-2 flex items-center gap-1">
              <Check className="h-3 w-3" /> Übernommen
            </p>
          )}

          {suggestion.status === 'edited' && (
            <p className="text-xs text-primary mt-2 flex items-center gap-1">
              <Pencil className="h-3 w-3" /> Bearbeitet & übernommen
            </p>
          )}

          {suggestion.status === 'pending' && (
            <div className="flex gap-2 mt-4 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-success hover:text-success hover:bg-success/10 hover:border-success/50"
                onClick={() => onAccept(suggestion.id)}
              >
                <Check className="h-4 w-4 mr-1" />
                Übernehmen
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 hover:bg-primary/10 hover:border-primary/50"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Bearbeiten
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                onClick={() => onDiscard(suggestion.id)}
              >
                <X className="h-4 w-4 mr-1" />
                Verwerfen
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

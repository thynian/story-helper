import { Spinner } from "@/components/ui/spinner";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Wird geladen..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground mt-4">{message}</p>
    </div>
  );
}

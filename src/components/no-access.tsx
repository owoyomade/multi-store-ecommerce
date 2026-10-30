import { Alert } from "@/components/ui/alert";

export function NoAccess({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
      <Alert tone="info">{message}</Alert>
    </div>
  );
}
